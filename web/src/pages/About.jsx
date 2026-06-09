import React from 'react';
import { Link } from 'react-router-dom';
import ViaLogo from '../components/ViaLogo';
import styles from './About.module.css';

const TEAM_VALUES = [
  { icon: '🤝', title: 'Community First', desc: 'We believe in the power of collective saving. Via is built to strengthen the bonds that make rotating savings groups work.' },
  { icon: '🔒', title: 'Security & Trust', desc: 'Every transaction is secured with end-to-end encryption. Identity verification ensures every member is who they say they are.' },
  { icon: '📱', title: 'Accessible to All', desc: 'Via works on any device, in 8 languages, across African markets and beyond. Financial tools should be for everyone.' },
  { icon: '⚡', title: 'Instant & Reliable', desc: 'Automatic payouts, real-time notifications, and a wallet that works 24/7. No waiting, no manual transfers.' },
];

export default function About() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '0 0 40px' }}>
      <div className={styles.page}>
      {/* Hero */}
      <div className={styles.hero}>
        <ViaLogo size={80} />
        <h1>About Via</h1>
        <p className={styles.tagline}>
          The modern platform for rotating savings groups — trusted, transparent, and built for your community.
        </p>
      </div>

      {/* Mission */}
      <div className={styles.card}>
        <h2>Our Mission</h2>
        <p>
          Via was created to bring the traditional Njangi/Tontine savings model into the digital age.
          Millions of people across Africa rely on rotating savings groups to fund education, businesses,
          and emergencies — but managing them manually is risky and time-consuming.
        </p>
        <p>
          Via makes it easy to organize, track, and automate your savings circle with complete transparency,
          automated payouts, and a built-in digital wallet.
        </p>
      </div>

      {/* Values */}
      <div className={styles.valuesGrid}>
        {TEAM_VALUES.map(v => (
          <div key={v.title} className={styles.valueCard}>
            <div className={styles.valueIcon}>{v.icon}</div>
            <div className={styles.valueTitle}>{v.title}</div>
            <div className={styles.valueDesc}>{v.desc}</div>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className={styles.card}>
        <h2>How It Works</h2>
        <div className={styles.steps}>
          {[
            { n: '1', t: 'Create or Join a Group', d: 'Set up a savings circle with your community, family, or colleagues. Define the contribution amount, cycle, and member limit.' },
            { n: '2', t: 'Contribute Every Cycle', d: 'Pay your contribution on time each cycle using MTN MoMo, Orange Money, or your Via TC wallet.' },
            { n: '3', t: 'Receive Your Payout', d: 'When it\'s your turn in the queue, the full pool is automatically sent to your wallet. Everyone gets their fair share.' },
            { n: '4', t: 'Repeat & Grow', d: 'After each circle, the group re-forms. Members can update settings, new members can join, and the cycle continues.' },
          ].map(s => (
            <div key={s.n} className={styles.step}>
              <div className={styles.stepNum}>{s.n}</div>
              <div>
                <div className={styles.stepTitle}>{s.t}</div>
                <div className={styles.stepDesc}>{s.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contact */}
      <div className={styles.card} style={{ textAlign: 'center' }}>
        <h2>Contact Us</h2>
        <p style={{ color: 'var(--text-sub)', marginBottom: 16 }}>Questions? We're here to help.</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
          <a href="mailto:support@via-savings.com" className={styles.contactBtn}>📧 support@via-savings.com</a>
          <Link to="/help" className={styles.contactBtn}>❓ Help Center</Link>
        </div>
      </div>
    </div>
    </div>
  );
}
