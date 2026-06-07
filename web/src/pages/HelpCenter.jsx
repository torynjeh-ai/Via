import React, { useState } from 'react';
import styles from './HelpCenter.module.css';

const FAQS = [
  {
    category: 'Getting Started',
    icon: '🚀',
    items: [
      { q: 'What is Via?', a: 'Via is a digital savings platform for rotating savings groups (Njangi/Tontine). Members contribute regularly and take turns receiving the full pool.' },
      { q: 'How do I verify my identity?', a: 'Go to Profile → Verify Identity. You\'ll need a government-issued ID or passport and a selfie. Verification is required before joining or creating groups.' },
      { q: 'What is a Trust Coin (TC)?', a: 'Trust Coin is Via\'s in-app currency. 1 TC = 10,000 XAF. You can top up your TC wallet with real money and use it for contributions, transfers, and savings.' },
    ],
  },
  {
    category: 'Groups & Contributions',
    icon: '👥',
    items: [
      { q: 'How does a savings circle work?', a: 'Members each contribute a fixed amount every cycle (weekly/biweekly/monthly). One member receives the full pool each cycle based on their queue position. Everyone gets their turn.' },
      { q: 'Can I leave a group mid-circle?', a: 'No. Once a circle starts, you must complete it. You can only leave during the re-forming phase after a circle ends. Leaving mid-circle is not permitted.' },
      { q: 'What happens if I pay late?', a: 'A late penalty (set by the admin) is added to your contribution. The penalty is split equally among all other group members.' },
      { q: 'Can I join a group via an invite link?', a: 'Yes. Click the invite link, review the group details, accept the terms, and submit your join request. The admin must approve before you\'re officially a member.' },
    ],
  },
  {
    category: 'Wallet & Payments',
    icon: '💰',
    items: [
      { q: 'How do I top up my wallet?', a: 'Go to Wallet → Top Up. Select MTN MoMo or Orange Money, enter the amount, and complete payment on the Fapshi checkout page.' },
      { q: 'How do I withdraw money?', a: 'Go to Wallet → Withdraw. Enter the amount and choose your preferred payout method. Withdrawals are processed within 24 hours.' },
      { q: 'Can I transfer TC to another user?', a: 'Yes. Go to Wallet → Transfer. Enter the recipient\'s phone number or wallet code (VIA-XXXXX). Transfers between group members in active groups are free.' },
      { q: 'Why can\'t I empty my wallet?', a: 'If you have received a payout in an active group, your wallet must keep enough balance to cover your remaining contributions.' },
    ],
  },
  {
    category: 'Account & Security',
    icon: '🔒',
    items: [
      { q: 'What if I forget my password?', a: 'On the login page, leave the password field empty and click Sign In — an OTP will be sent to your phone number to log in without a password.' },
      { q: 'How is my data protected?', a: 'Your data is encrypted in transit (HTTPS) and at rest. We never share your personal information with third parties without your consent.' },
      { q: 'Can someone access my account if I lose my phone?', a: 'No. Every login requires your phone number and password (or an OTP sent to your phone). Without your SIM, no one can access your account.' },
    ],
  },
];

const CONTACT = [
  { icon: '📞', label: 'Phone / WhatsApp', value: '+237 6XX XXX XXX', href: 'tel:+237600000000' },
  { icon: '📧', label: 'Email', value: 'support@via-savings.com', href: 'mailto:support@via-savings.com' },
  { icon: '💬', label: 'Live Chat', value: 'Available 8am–8pm WAT', href: null },
];

export default function HelpCenter() {
  const [openIdx, setOpenIdx] = useState({});

  const toggle = (cat, idx) => {
    setOpenIdx(prev => ({
      ...prev,
      [`${cat}-${idx}`]: !prev[`${cat}-${idx}`],
    }));
  };

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <h1>Help Center</h1>
        <p>Find answers to common questions or contact our support team</p>
      </div>

      {/* Contact cards */}
      <div className={styles.contactGrid}>
        {CONTACT.map(c => (
          <div key={c.label} className={styles.contactCard}>
            <div className={styles.contactIcon}>{c.icon}</div>
            <div className={styles.contactLabel}>{c.label}</div>
            {c.href ? (
              <a href={c.href} className={styles.contactValue}>{c.value}</a>
            ) : (
              <div className={styles.contactValue}>{c.value}</div>
            )}
          </div>
        ))}
      </div>

      {/* FAQs */}
      {FAQS.map(section => (
        <div key={section.category} className={styles.section}>
          <h2>{section.icon} {section.category}</h2>
          {section.items.map((item, idx) => {
            const key = `${section.category}-${idx}`;
            const isOpen = openIdx[key];
            return (
              <div key={idx} className={styles.faqItem}>
                <button className={styles.faqQ} onClick={() => toggle(section.category, idx)}>
                  <span>{item.q}</span>
                  <span className={styles.chevron}>{isOpen ? '▲' : '▼'}</span>
                </button>
                {isOpen && <div className={styles.faqA}>{item.a}</div>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
