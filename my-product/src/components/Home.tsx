import { useState } from 'react';
declare global {
  interface Window {
    Razorpay: any;
  }
}
const Home = () => {

  const [amount, setAmount] = useState('');
  const [currency, setcurrency] = useState('');

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  

  const handlePayment = async () => {
    // 1. Load the script
    const res = await loadRazorpayScript();
    if (!res) {
      alert('Razorpay SDK failed to load. Are you online?');
      return;
    }
    
  const response = await fetch('https://primepiptrade.com/v1/addFundsToWallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' 
        ,'Authorization': `Bearer ${localStorage.getItem('authToken')}`

      },
      body: JSON.stringify({ amount: amount, currency: currency }),
    });
    const orderData = await response.json();
    console.log("Data from backend:", orderData);
    const options = {
    key: orderData.key, // Use the key provided by your backend
    amount: orderData.amount,
    currency: "INR",
    name: "Your Business Name",
    order_id: orderData.id,
    handler: async function (response:any) {
      // Handle success
      console.log(response);
      const verifyResponse = await fetch('https://primepiptrade.com/v1/VerifyFundPayements', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken')}` // Ensure you include your auth headers
      },
      body: JSON.stringify({
        razorpay_order_id: orderData.razorpay_order.id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
      }),
      
    }
   

  
  );
    const vResponse=await verifyResponse.json()
    if(vResponse.status == '200'){

    }
    alert("Payment Successful!");
    },
    prefill: { currency: currency },
    theme: { color: "#3399cc" },
  };
  
  const paymentObject = new window.Razorpay(options);
  paymentObject.open();

  };
  return (
    <div style={{
      backgroundColor: '#ffffff',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      fontFamily: 'sans-serif',
      padding: '20px'
    }}>
      <h1 style={{ fontSize: '3rem', color: '#1e293b' }}>Welcome to PrimePipTrade</h1>
      <blockquote style={{ 
        fontSize: '1.25rem', 
        color: '#64748b', 
        fontStyle: 'italic', 
        marginTop: '20px' 
      }}>
        "The market is a device for transferring money from the impatient to the patient."
      </blockquote>
      <div style={{ padding: '20px' }}>
      <h2>Razorpay Payment</h2>
      
      <div>
        <input 
          type="number" 
          placeholder="Enter Amount (INR)" 
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ display: 'block', margin: '10px 0', padding: '8px' }}
        />
        <input 
          type="email" 
          placeholder="Enter currency type" 
          value={currency}
          onChange={(e) => setcurrency(e.target.value)}
          style={{ display: 'block', margin: '10px 0', padding: '8px' }}
        />
      </div>

      <button onClick={handlePayment} style={{ padding: '10px 20px', cursor: 'pointer' }}>
        Pay Now
      </button>
    </div>
    </div>
  );
};

export default Home;