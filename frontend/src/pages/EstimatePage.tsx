import { useCart } from '../hooks/useCart';
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Plus, Minus, Trash2 } from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-US').format(n);

export default function EstimatePage() {
  const cart = useCart();
  const printRef = useRef<HTMLDivElement>(null);

  const docNumber = String(Math.floor(1000 + Math.random() * 9000));
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const subtotal = cart.totalPrice;

  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Quote #${docNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #333; padding: 40px 50px; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1a365d; padding-bottom: 15px; }
        .header h1 { font-size: 20px; color: #1a365d; margin-bottom: 4px; }
        .header p { font-size: 12px; color: #666; }
        .meta { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 12px; }
        .intro { background: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 20px; font-size: 12px; line-height: 1.5; }
        .executor { margin-bottom: 20px; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background: #1a365d; color: white; padding: 8px 10px; text-align: left; font-size: 12px; }
        td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
        tr:nth-child(even) { background: #f7fafc; }
        .text-right { text-align: right; }
        .totals { margin-top: 10px; text-align: right; font-size: 13px; }
        .totals .grand { font-size: 16px; font-weight: bold; color: #1a365d; margin-top: 8px; }
        .footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #666; text-align: center; }
        @media print { body { padding: 20px; } }
      </style>
    </head><body>${el.innerHTML}</body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); }, 300);
  };

  if (cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-transparent sf-fade-in flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 text-lg mb-4">Cart is empty</p>
          <Link to="/catalog" className="text-teal-700 hover:text-teal-800 font-medium">← Back to catalog</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent sf-fade-in">
      {/* Controls bar */}
      <div className="bg-white/85 backdrop-blur-md shadow-sm border-b border-slate-200/80 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/catalog" className="flex items-center gap-1 text-sm text-teal-700 hover:text-teal-800">
            <ArrowLeft size={16} /> Catalog
          </Link>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-teal-700 text-white rounded-lg text-sm font-medium hover:bg-teal-800"
            >
              <Download size={16} /> Print / PDF
            </button>
          </div>
        </div>
      </div>

      {/* Editable cart section */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="sf-card rounded-xl border border-slate-200 p-4 mb-4">
          <h3 className="text-sm font-medium text-slate-700 mb-3">Edit line items</h3>
          <div className="space-y-2">
            {cart.items.map(item => (
              <div key={item.id} className="flex items-center gap-3 text-sm">
                <span className="flex-1 truncate">{item.name}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => cart.updateQuantity(item.id, item.quantity - 1)} className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200"><Minus size={12} /></button>
                  <span className="w-8 text-center font-medium">{item.quantity}</span>
                  <button onClick={() => cart.updateQuantity(item.id, item.quantity + 1)} className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200"><Plus size={12} /></button>
                </div>
                <span className="w-32 text-right font-medium">{fmt((item.discountedPrice ?? item.price) * item.quantity)} sum</span>
                <button onClick={() => cart.removeItem(item.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Print preview */}
      <div className="max-w-4xl mx-auto px-4 pb-8">
        <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-slate-200" style={{ minHeight: '297mm' }}>
          <div ref={printRef} className="p-12">
            <div className="header" style={{ textAlign: 'center', marginBottom: 30, borderBottom: '2px solid #1a365d', paddingBottom: 15 }}>
              <h1 style={{ fontSize: 22, color: '#1a365d', marginBottom: 4, fontWeight: 'bold' }}>YAMAHA STORE</h1>
              <p style={{ fontSize: 12, color: '#666' }}>Commercial proposal</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, fontSize: 12 }}>
              <span>Quote #{docNumber}</span>
              <span>{today}</span>
            </div>

            <div style={{ background: '#f8f9fa', padding: 15, borderRadius: 6, marginBottom: 20, fontSize: 12, lineHeight: 1.6 }}>
              Yamaha Store is an official distributor of musical equipment from leading global brands. We offer professional gear with quality warranty and service support.
            </div>

            <div style={{ marginBottom: 20, fontSize: 12 }}>
              <strong>Provider:</strong> Yamaha Store LLC<br />
              <strong>Address:</strong> Almaty<br />
              <strong>Phone:</strong> +7 (XXX) XXX-XX-XX
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
              <thead>
                <tr>
                  <th style={{ background: '#1a365d', color: 'white', padding: '8px 10px', textAlign: 'left', fontSize: 12 }}>№</th>
                  <th style={{ background: '#1a365d', color: 'white', padding: '8px 10px', textAlign: 'left', fontSize: 12 }}>Item</th>
                  <th style={{ background: '#1a365d', color: 'white', padding: '8px 10px', textAlign: 'right', fontSize: 12 }}>Qty</th>
                  <th style={{ background: '#1a365d', color: 'white', padding: '8px 10px', textAlign: 'right', fontSize: 12 }}>Unit price</th>
                  <th style={{ background: '#1a365d', color: 'white', padding: '8px 10px', textAlign: 'right', fontSize: 12 }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {cart.items.map((item, i) => {
                  const unitPrice = item.discountedPrice ?? item.price;
                  return (
                    <tr key={item.id} style={{ background: i % 2 === 1 ? '#f7fafc' : 'white' }}>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #e2e8f0', fontSize: 12 }}>{i + 1}</td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #e2e8f0', fontSize: 12 }}>
                        {item.name}
                        {item.category && <span style={{ color: '#999', marginLeft: 6, fontSize: 11 }}>({item.category})</span>}
                      </td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #e2e8f0', fontSize: 12, textAlign: 'right' }}>{item.quantity}</td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #e2e8f0', fontSize: 12, textAlign: 'right' }}>{fmt(unitPrice)} sum</td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #e2e8f0', fontSize: 12, textAlign: 'right', fontWeight: 600 }}>{fmt(unitPrice * item.quantity)} sum</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ textAlign: 'right', fontSize: 13 }}>
              <p>Subtotal: <strong>{fmt(subtotal)} sum</strong></p>
              <p>VAT (0%): <strong>0 sum</strong></p>
              <p style={{ fontSize: 18, fontWeight: 'bold', color: '#1a365d', marginTop: 8 }}>Total: {fmt(subtotal)} sum</p>
            </div>

            <div style={{ marginTop: 40, paddingTop: 15, borderTop: '1px solid #e2e8f0', fontSize: 11, color: '#666', textAlign: 'center' }}>
              Yamaha Store — Official musical equipment distributor
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
