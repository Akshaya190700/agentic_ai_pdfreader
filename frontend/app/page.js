"use client";
import { useState, useEffect, useRef } from "react";
import { Upload, Send, FileText, MessageCircle, Loader2, CheckCircle, AlertCircle } from "lucide-react";

export default function Page() {
  const [file, setFile] = useState(null);
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Safe localStorage access in client only
  useEffect(() => {
    const id = localStorage.getItem("doc_id");
    if (id) setSessionId(id);
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function uploadPdf(e) {
    if (e) e.preventDefault();
    if (!file) {
      setUploadStatus({ type: "error", message: "Please select a PDF file" });
      return;
    }

    setIsUploading(true);
    setUploadStatus(null);
    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("http://localhost:8000/upload_pdf", {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const err = await res.text();
        setUploadStatus({ type: "error", message: "Upload failed: " + err });
        return;
      }

      const data = await res.json();
      setSessionId(data.doc_id);
      localStorage.setItem("doc_id", data.doc_id);
      setUploadStatus({ type: "success", message: "PDF uploaded successfully!" });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setUploadStatus({ type: "error", message: "Upload error: " + err.message });
    } finally {
      setIsUploading(false);
    }
  }

  async function sendMessage(e) {
    e?.preventDefault();
    if (!sessionId) {
      setUploadStatus({ type: "error", message: "Please upload a PDF first" });
      return;
    }
    if (!input.trim()) return;

    setIsSending(true);
    const userMessage = input.trim();
    setInput("");

    // Add user message immediately
    setMessages(prev => [...prev, { from: "user", text: userMessage }]);

    try {
      const res = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message: userMessage }),
      });

      const data = await res.json();
      setMessages(prev => [...prev, { from: "bot", text: data.answer }]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { from: "bot", text: "Sorry, there was an error processing your message. Please try again." }
      ]);
    } finally {
      setIsSending(false);
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(e);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-3 rounded-full">
              <FileText className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            PDF Chat Assistant
          </h1>
          <p className="text-gray-600 text-lg">Upload your PDF and start asking questions</p>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 mb-8">
          <div className="flex items-center mb-6">
            <Upload className="w-6 h-6 text-blue-600 mr-3" />
            <h2 className="text-2xl font-semibold text-gray-800">Upload PDF</h2>
          </div>
          
          <div className="space-y-6">
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={(e) => {
                  setFile(e.target.files[0]);
                  setUploadStatus(null);
                }}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-3 file:px-6 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-colors cursor-pointer"
              />
            </div>
            
            <button
              onClick={uploadPdf}
              disabled={!file || isUploading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 mr-2" />
                  Upload PDF
                </>
              )}
            </button>
          </div>

          {/* Upload Status */}
          {uploadStatus && (
            <div className={`mt-4 p-4 rounded-xl flex items-center ${
              uploadStatus.type === "success" 
                ? "bg-green-50 text-green-700 border border-green-200" 
                : "bg-red-50 text-red-700 border border-red-200"
            }`}>
              {uploadStatus.type === "success" ? (
                <CheckCircle className="w-5 h-5 mr-2" />
              ) : (
                <AlertCircle className="w-5 h-5 mr-2" />
              )}
              {uploadStatus.message}
            </div>
          )}
        </div>

        {/* Chat Section */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Chat Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6">
            <div className="flex items-center text-white">
              <MessageCircle className="w-6 h-6 mr-3" />
              <h2 className="text-2xl font-semibold">Chat</h2>
              <div className="ml-auto">
                <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
                  {sessionId ? `ID: ${sessionId.slice(0, 8)}...` : "No PDF loaded"}
                </span>
              </div>
            </div>
          </div>

          {/* Messages Container */}
          <div className="h-96 overflow-y-auto p-6 bg-gray-50">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg">No messages yet</p>
                  <p className="text-sm">Upload a PDF and start asking questions!</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.from === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl shadow-sm ${
                        message.from === "user"
                          ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-br-sm"
                          : "bg-white text-gray-800 border border-gray-200 rounded-bl-sm"
                      }`}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {message.text}
                      </p>
                    </div>
                  </div>
                ))}
                {isSending && (
                  <div className="flex justify-start">
                    <div className="bg-white text-gray-800 border border-gray-200 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm">
                      <div className="flex items-center">
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        <span className="text-sm">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input Form */}
          <div className="p-6 border-t border-gray-200 bg-white">
            <div className="flex space-x-3">
              <div className="flex-1 relative">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask about the PDF, or say 'calculate 2+2'..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-black placeholder-gray-400"
                  disabled={isSending}
                />
              </div>
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isSending || !sessionId}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
