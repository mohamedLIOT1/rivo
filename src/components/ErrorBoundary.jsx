import React from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Rivo ErrorBoundary caught:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-[#17a398] text-[#0b1110] flex flex-col items-center justify-center p-6 text-center select-none overflow-y-auto">
          <div className="bg-[#fdfbf7] brutal-border-thick brutal-shadow-lg p-8 max-w-lg w-full text-center">
            <div className="w-14 h-14 bg-red-100 text-[#dc2626] brutal-border flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={28} />
            </div>
            <div className="text-[10px] font-mono font-black uppercase text-[#17a398] mb-1">
              APOTHECARY SAFETY INTERVENTION
            </div>
            <h1 className="text-xl md:text-2xl font-mono font-black uppercase text-[#082621] mb-2">
              DISPENSARY INTERRUPTION
            </h1>
            <p className="text-xs text-[#082621]/70 mb-4 font-sans">
              Click below to reset local audio storage and relaunch Rivo cleanly.
            </p>

            {this.state.error && (
              <div className="bg-[#ede5d3] brutal-border p-3 text-left text-xs font-mono text-[#0b1110] mb-5 overflow-x-auto">
                <p className="font-bold mb-1 text-[#dc2626]">{this.state.error.toString()}</p>
                {this.state.errorInfo && (
                  <pre className="text-[10px] text-[#082621]/60 whitespace-pre-wrap">{this.state.errorInfo.componentStack}</pre>
                )}
              </div>
            )}

            <button
              onClick={() => {
                try {
                  localStorage.clear();
                  sessionStorage.clear();
                } catch(e){}
                window.location.href = window.location.origin;
              }}
              className="brutal-btn w-full py-3 bg-[#082621] hover:bg-[#0b1110] text-[#26c4b7] font-mono text-xs font-black uppercase brutal-border brutal-shadow flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw size={16} />
              <span>RESET CACHE & RELAUNCH RIVO</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
