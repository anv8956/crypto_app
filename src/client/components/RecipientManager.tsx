import React, { useState } from 'react';
import {
  Users,
  Plus,
  Building,
  CheckCircle2,
  Send,
  AlertCircle,
  Search,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { Recipient } from '../../shared/types';
import { apiClient } from '../api';

interface RecipientManagerProps {
  recipients: Recipient[];
  onRefresh: () => void;
  onSendToRecipient: (recipient: Recipient) => void;
}

export const RecipientManager: React.FC<RecipientManagerProps> = ({
  recipients,
  onRefresh,
  onSendToRecipient,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('US');
  const [payoutMethod, setPayoutMethod] = useState('US_FEDNOW');
  const [relationship, setRelationship] = useState('Friend');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredRecipients = recipients.filter(
    (r) =>
      r.fullName.toLowerCase().includes(search.toLowerCase()) ||
      r.email.toLowerCase().includes(search.toLowerCase()) ||
      r.bankAccount.bankName.toLowerCase().includes(search.toLowerCase())
  );

  const handleCountryChange = (c: string) => {
    setCountry(c);
    if (c === 'US') setPayoutMethod('US_FEDNOW');
    else if (c === 'IN') setPayoutMethod('IN_IMPS');
    else if (c === 'GB') setPayoutMethod('UK_FPS');
    else setPayoutMethod('EU_SEPA');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      await apiClient.createRecipient({
        fullName,
        email,
        country,
        payoutMethod,
        relationship,
        bankName,
        accountNumber,
        routingNumber: country === 'US' ? routingNumber : undefined,
        ifscCode: country === 'IN' ? ifscCode : undefined,
      });

      setShowAddModal(false);
      // Reset form
      setFullName('');
      setEmail('');
      setBankName('');
      setAccountNumber('');
      setRoutingNumber('');
      setIfscCode('');
      onRefresh();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to add recipient');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Saved Beneficiaries</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Verified local bank accounts eligible for instant stablecoin-to-fiat delivery
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-sm transition-all shadow-md shadow-emerald-500/20 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Beneficiary</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or bank..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
        />
      </div>

      {/* Recipients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRecipients.length === 0 ? (
          <div className="col-span-full p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center">
            <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300">No recipients found</p>
            <p className="text-xs text-slate-500 mt-1">Add a new beneficiary or try a different search filter.</p>
          </div>
        ) : (
          filteredRecipients.map((recip) => (
            <div
              key={recip.id}
              className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">
                      {recip.country === 'US' ? '🇺🇸' : recip.country === 'IN' ? '🇮🇳' : recip.country === 'GB' ? '🇬🇧' : '🇪🇺'}
                    </span>
                    <div>
                      <h3 className="font-bold text-white text-sm">{recip.fullName}</h3>
                      <p className="text-[11px] text-slate-400">{recip.email}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Verified</span>
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs space-y-1.5 my-3">
                  <div className="flex justify-between text-slate-400">
                    <span>Bank:</span>
                    <span className="text-slate-200 font-semibold">{recip.bankAccount.bankName}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Account:</span>
                    <span className="font-mono text-slate-300">{recip.bankAccount.accountNumberMasked}</span>
                  </div>
                  {recip.bankAccount.routingNumber && (
                    <div className="flex justify-between text-slate-400">
                      <span>ABA Routing:</span>
                      <span className="font-mono text-slate-300">{recip.bankAccount.routingNumber}</span>
                    </div>
                  )}
                  {recip.bankAccount.ifscCode && (
                    <div className="flex justify-between text-slate-400">
                      <span>IFSC Code:</span>
                      <span className="font-mono text-slate-300">{recip.bankAccount.ifscCode}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800">
                    <span>Payout Rail:</span>
                    <span className="text-emerald-400 font-mono text-[11px] font-bold">{recip.payoutMethod}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onSendToRecipient(recip)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs flex items-center justify-center space-x-2 transition-colors cursor-pointer mt-2"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Money</span>
              </button>
            </div>
          ))
        )}
      </div>

      {/* Add Recipient Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">Add New Beneficiary</h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter bank details. All account identifiers are validated on-chain and against clearing standards.
            </p>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Destination Country</label>
                  <select
                    value={country}
                    onChange={(e) => handleCountryChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="US">🇺🇸 United States (USD)</option>
                    <option value="IN">🇮🇳 India (INR)</option>
                    <option value="GB">🇬🇧 United Kingdom (GBP)</option>
                    <option value="EU">🇪🇺 European Union (EUR)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Payout Rail</label>
                  <select
                    value={payoutMethod}
                    onChange={(e) => setPayoutMethod(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  >
                    {country === 'US' && (
                      <>
                        <option value="US_FEDNOW">FedNow Instant (24/7)</option>
                        <option value="US_ACH">ACH Direct Deposit</option>
                        <option value="US_WIRE">Domestic Wire</option>
                      </>
                    )}
                    {country === 'IN' && (
                      <>
                        <option value="IN_IMPS">NPCI IMPS Fast Rail</option>
                        <option value="IN_UPI">UPI VPA</option>
                      </>
                    )}
                    {country === 'GB' && <option value="UK_FPS">Faster Payments (FPS)</option>}
                    {country === 'EU' && <option value="EU_SEPA">SEPA Instant Transfer</option>}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Beneficiary Full Legal Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Rahul Patel"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Email (for payment notification)</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="rahul@example.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Bank Name</label>
                  <input
                    type="text"
                    required
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. JPMorgan Chase"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Account Number</label>
                  <input
                    type="text"
                    required
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="123456789"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              {country === 'US' && (
                <div>
                  <label className="text-slate-400 block mb-1">9-digit ABA Routing Number</label>
                  <input
                    type="text"
                    required
                    maxLength={9}
                    value={routingNumber}
                    onChange={(e) => setRoutingNumber(e.target.value)}
                    placeholder="021000021"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Found on the bottom of a US check.</p>
                </div>
              )}

              {country === 'IN' && (
                <div>
                  <label className="text-slate-400 block mb-1">11-character Indian IFSC Code</label>
                  <input
                    type="text"
                    required
                    maxLength={11}
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                    placeholder="HDFC0001234"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono uppercase"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">4 letters, 0, and 6 alphanumeric characters.</p>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
                >
                  {isSubmitting ? 'Validating...' : 'Save Beneficiary'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
