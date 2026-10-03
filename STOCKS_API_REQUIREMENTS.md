# Stocks API — Backend Requirements (Shoonya Integration)

This document specifies the backend endpoints the frontend now expects, so the
"Explore Stocks" section and the navbar search can show real, live stock
data from Shoonya (Finvasia). It also documents the existing conventions this
backend already follows for Mutual Funds / F&O, so the new endpoints feel
consistent to the frontend.

All endpoints below are served from the same host the rest of the app already
uses: `https://api.primepiptrade.com`.

## 0. Conventions already used elsewhere in this API (follow the same rules)

- **Errors**: `{ "detail": "human readable message" }`, or on validation
  failure an array of pydantic-style issues: `{ "detail": [{ "loc": [...],
  "msg": "..." }] }`. The frontend already knows how to parse both shapes.
- **Auth**: market-data reads are public (no `Authorization` header), same as
  `/api/mutual-funds/*`. Only trading actions (place order, positions,
  holdings) need the existing JWT bearer auth.
- **Numbers**: prices/NAV as plain JSON numbers (not strings), 2 decimal
  precision where applicable.
- **CORS**: must allow the frontend origin, same as existing endpoints.

## 1. Shoonya session management (server-side only, never exposed to frontend)

Shoonya's NorenAPI requires a login (userid, password, TOTP/factor2, vendor
code, api secret, imei) that returns a `susertoken` used for all subsequent
REST/WebSocket calls. This must live entirely in the backend:

- Maintain one authenticated Shoonya session per day (tokens expire daily —
  re-login on a schedule, e.g. every day at market pre-open ~08:45 IST, and
  on 401/session-expired responses from Shoonya).
- Store credentials in backend env vars, never in a repo or sent to the
  frontend:
  `SHOONYA_USER_ID`, `SHOONYA_PASSWORD`, `SHOONYA_TOTP_SECRET` (or static
  factor2 if TOTP isn't used), `SHOONYA_VENDOR_CODE`, `SHOONYA_API_SECRET`,
  `SHOONYA_IMEI`.
- Subscribe to Shoonya's WebSocket feed (`NorenApi.start_websocket`) for the
  symbols currently being viewed/searched by any connected frontend user, and
  cache the latest tick per symbol in memory/Redis. REST endpoints below
  should read from that cache (fast, no per-request round-trip to Shoonya),
  not call Shoonya synchronously per request.
- Historical candles: Shoonya's `get_time_price_series` (per-minute) can be
  used to backfill/aggregate into the chart periods below.

## 2. Symbol master / instrument list

Shoonya publishes a daily symbol master (CSV per exchange: NSE, BSE, NFO,
etc., e.g. `https://api.shoonya.com/NSE_symbols.txt.zip`). Backend should:

- Download and refresh this daily (pre-market).
- Store it in a DB table/collection: `symbol`, `exchange`, `token` (Shoonya's
  numeric instrument token — required for all Shoonya API calls), `name`
  (company name), `sector` (if available; otherwise backfill from a static
  NSE sector mapping), `lot_size`, `tick_size`.
- This table backs the `/search` and `/facets` endpoints below and is also
  what resolves a human symbol like `RELIANCE` + exchange `NSE` to the
  Shoonya token needed to fetch quotes/candles.

## 3. Endpoints to build

### `GET /api/stocks/explore`
Powers the "Explore" tab landing page.

```json
{
  "market_status": "OPEN",           // "OPEN" | "CLOSED" | "PRE_OPEN"
  "trending": [ StockSummary, ... ],   // e.g. by volume or a curated list
  "top_gainers": [ StockSummary, ... ],
  "top_losers": [ StockSummary, ... ],
  "most_active": [ StockSummary, ... ],
  "collections": [ { "key": "nifty50", "title": "Nifty 50", "icon_hint": "trending-up" }, ... ]
}
```

`StockSummary`:
```json
{
  "symbol": "RELIANCE",
  "exchange": "NSE",
  "name": "Reliance Industries Ltd",
  "ltp": 2934.55,
  "change": 12.30,
  "change_pct": 0.42,
  "volume": 5231000,
  "sector": "Energy"
}
```

### `GET /api/stocks/facets`
Filter options for the search page.
```json
{ "exchanges": ["NSE", "BSE"], "sectors": ["Energy", "IT", "Banking", ...] }
```

### `GET /api/stocks/search?q=&exchange=&sector=&page=&page_size=`
Paginated search over the symbol master, ranked by relevance to `q` (prefix
match on symbol first, then name substring match). Same pagination contract
as `/api/mutual-funds/search` (page starts at 1; a short page = last page).

Response: `StockSummary[]`.

### `GET /api/stocks/{exchange}/{symbol}/quote`
The single most important endpoint — live quote for one stock, read from the
Shoonya WebSocket tick cache described in §1 (fast — must not block on a
live Shoonya call). 404 if the symbol doesn't exist.

```json
{
  "symbol": "RELIANCE",
  "exchange": "NSE",
  "name": "Reliance Industries Ltd",
  "ltp": 2934.55,
  "change": 12.30,
  "change_pct": 0.42,
  "open": 2925.00,
  "high": 2941.00,
  "low": 2918.50,
  "close": 2922.25,
  "volume": 5231000,
  "avg_price": 2930.10,
  "upper_circuit": 3214.45,
  "lower_circuit": 2630.05,
  "week_52_high": 3024.20,
  "week_52_low": 2220.30,
  "market_cap": 19850000000000,
  "pe_ratio": 24.6,
  "depth": {
    "bids": [ { "price": 2934.50, "qty": 120, "orders": 4 }, ... up to 5 ],
    "asks": [ { "price": 2934.60, "qty": 80,  "orders": 3 }, ... up to 5 ]
  },
  "is_market_open": true,
  "last_updated": "2026-09-20T10:15:32+05:30"
}
```

Frontend polls this every **3 seconds** while `is_market_open` is true (see
`StockDetail.tsx`). If/when a websocket transport is added to this backend,
we'd rather subscribe directly — flagged as a fast-follow, not required now.

### `GET /api/stocks/{exchange}/{symbol}/chart?period=1d|1w|1m|6m|1y|5y`
Candle series for the price chart, aggregated from Shoonya's minute-candle
API into the requested granularity (e.g. `1d` → 5-min candles for today,
`5y` → weekly candles).

```json
{
  "symbol": "RELIANCE",
  "period": "1d",
  "candles": [
    { "timestamp": 1758345000, "open": 2925.0, "high": 2930.0, "low": 2922.0, "close": 2928.5, "volume": 120500 },
    ...
  ]
}
```

### `GET /api/search?q=&limit=`
**New** combined endpoint for the navbar search bar — merges a stock search
and a mutual-fund search into one response so the frontend makes a single
call while typing.

```json
{
  "stocks": [ StockSummary, ... up to `limit` ],
  "mutual_funds": [
    { "scheme_code": 119551, "scheme_name": "...", "fund_house": "...", "latest_nav": 45.23 },
    ... up to `limit`
  ]
}
```
`limit` defaults to 6 per section if omitted. This can be a thin fan-out to
the existing `/api/mutual-funds/search` logic plus the new
`/api/stocks/search` logic — no new ranking system needed, just merge.

## 4. Frontend files already built against this contract

- `src/lib/stocks.ts` — TypeScript types for every response shape above.
- `src/components/ExploreStocks.tsx` — Explore/Watchlist tabs, calls
  `/api/stocks/explore`, polls every 5s while market is open.
- `src/components/StockSearch.tsx` — calls `/api/stocks/facets` and
  `/api/stocks/search`.
- `src/components/StockDetail.tsx` — calls `/api/stocks/{exchange}/{symbol}/quote`
  (polled every 3s while open) and `/api/stocks/{exchange}/{symbol}/chart`.
- `src/components/header.tsx` — navbar search calls `/api/search?q=&limit=6`.

Routes are live at `/explore/stocks`, `/explore/stocks/search`, and
`/explore/stocks/:exchange/:symbol`. Once these endpoints exist and return
the shapes above, the "Explore Stocks" feature is fully functional — no
further frontend changes should be needed.

## 5. Not in scope for this pass (flag if you want these too)

- Placing/managing real orders through Shoonya (buy/sell) — the detail page
  currently only displays data, no trading actions.
- A true push/streaming transport to the frontend (currently REST polling,
  matching this app's existing pattern everywhere else).
- Stock-level fundamentals beyond what's listed (e.g. financial statements,
  corporate actions, dividends) — can be added to the quote endpoint later
  as additional optional fields without breaking the frontend.
