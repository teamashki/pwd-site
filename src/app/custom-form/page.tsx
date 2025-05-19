"use client";

import { useState } from "react";
import 'react-phone-number-input/style.css';
import PhoneInput from 'react-phone-number-input';

//Dropdowns for types (ie: metals) toggle for diamonds (then provide diamond types)
//


export default function CustomPage() {
    const [formData, setFormData] = useState<{
        name: string;
        email: string;
        phone: string | undefined;
        message: string;
    }>({
        name: '',
        email: '',
        phone: undefined,
        message: '',
    });
  const [status, setStatus] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setStatus("Sending...");

        const res = await fetch("/api/custom/submit-request", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
        });

        const result = await res.json();
        setStatus(result.success ? "Request sent!" : "Something went wrong.");
    };

  return (
    <div className="min-h-screen bg-white text-black font-serif px-6 py-12">
      <h2 className="text-3xl font-bold text-center mb-8">Custom Request</h2>
      <form onSubmit={handleSubmit} className="max-w-xl mx-auto space-y-6">
        <input
            type="text"
            name="name"
            placeholder="Full Name"
            className="w-full px-5 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-lg bg-gray-50"
            required
            onChange={handleChange}
        />
        <input
            type="email"
            name="email"
            placeholder="Email Address"
            className="w-full px-5 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-lg bg-gray-50"
            required
            onChange={handleChange}
        />
        <PhoneInput
            defaultCountry="US"
            placeholder="Enter phone number"
            value={formData.phone}
            onChange={(value) => setFormData({ ...formData, phone: value })}
            className="phone-input w-full px-5 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-lg bg-gray-50"
        />
        <textarea
            name="message"
            placeholder="Tell us about your custom piece..."
            className="w-full px-5 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-lg bg-gray-50 h-32"
            required
            onChange={handleChange}
        />

        {/* <input
            type="file"
            name="attachment"
            className="block text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-black file:text-white hover:file:bg-gray-800"
        /> */}

        <button
            type="submit"
            className="w-full bg-black text-white text-lg py-3 rounded-lg hover:bg-gray-800 transition-all"
        >
            Submit Request
        </button>
        <p className="text-sm text-gray-500">{status}</p>
      </form>
    </div>
  );
}