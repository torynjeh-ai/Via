import { Link } from 'react-router-dom';
import ViaLogo from '../components/ViaLogo';
import styles from './Landing.module.css';

const FEATURES = [
  { icon: '🔄', title: 'Rotating Savings Circles', desc: 'Contribute together, take turns receiving the full pool. Automated, transparent, and fair.' },
  { icon: '🎯', title: 'Fundraiser Groups', desc: 'Pool money for any goal — emergencies, projects, or shared expenses. Admin controls disbursements.' },
  { icon: '💰', title: 'Trust Coin Wallet', desc: 'One wallet for all transactions. Top up, transfer, save, and contribute without leaving the app.' },
  { icon: '🏦', title: 'Personal Savings Goals', desc: 'Set a target, save consistently at your own pace, and withdraw when ready.' },
  { icon: '🛡️', title: 'Identity Verified Members', desc: 'Every member is verified with a government ID and face scan — so your group stays trustworthy.' },
  { icon: '⚡', title: 'Automatic Payouts', desc: 'When everyone contributes, your payout is sent instantly to your wallet. No waiting, no chasing.' },
];

const HOW_IT_WORKS = [
  { n: '1', t: 'Create an Account', d: 'Sign up with your phone number, verify your identity once, and you\'re ready to go.' },
  { n: '2', t: 'Join or Create a Group', d: 'Browse public groups or create your own savings circle. Set the amount, cycle, and member limit.' },
  { n: '3', t: 'Contribute Every Cycle', d: 'Pay your share on time using MTN MoMo, Orange Money, or your Via wallet.' },
  { n: '4', t: 'Receive Your Payout', d: 'When it\'s your turn, the full pool lands in your wallet automatically.' },
];

const STATS = [
  { value: 'MTN & Orange', label: 'Mobile Money Supported' },
  { value: '8',            label: 'Languages' },
  { value: '24/7',         label: 'Always Available' },
];

export default function Landing() {
  return (
    <div className={styles.page}>

      {/* ── Nav ── */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <div className={styles.navLogo}>
            <ViaLogo size={40} />
            <span className={styles.navBrand}>Via</span>
          </div>
          <div className={styles.navLinks}>
            <a href="#features" className={styles.navLink}>Features</a>
            <a href="#how" className={styles.navLink}>How it works</a>
            <Link to="/about" className={styles.navLink}>About</Link>
            <Link to="/login" className={styles.navLinkOutline}>Sign In</Link>
            <Link to="/register" className={styles.navLinkBtn}>Get Started</Link>
          </div>
          {/* Mobile: just the CTA */}
          <div className={styles.navMobile}>
            <Link to="/register" className={styles.navLinkBtn}>Get Started</Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>🌍 Built for African Communities</div>
          <h1 className={styles.heroTitle}>
            Save Together.<br />
            <span className={styles.heroAccent}>Grow Together.</span>
          </h1>
          <p className={styles.heroSub}>
            Via is the modern digital platform for rotating savings groups — Njangi, Tontine, Susu.
            Automated payouts, identity-verified members, and a built-in wallet. All in one app.
          </p>
          <div className={styles.heroCtas}>
            <Link to="/register" className={styles.ctaPrimary}>Start Saving Free →</Link>
            <a href="#how" className={styles.ctaSecondary}>See how it works</a>
          </div>
        </div>
        <div className={styles.heroVisual}>
          <div className={styles.mockPhone}>
            <div className={styles.mockScreen}>
              <div className={styles.mockHeader}>
                <div className={styles.mockAvatar}>V</div>
                <div>
                  <div className={styles.mockName}>Via Wallet</div>
                  <div className={styles.mockSub}>Trust Coin Balance</div>
                </div>
              </div>
              <div className={styles.mockBalance}>2.4500 TC</div>
              <div className={styles.mockXaf}>≈ 24,500 XAF</div>
              <div className={styles.mockCards}>
                <div className={styles.mockCard} style={{ background: 'rgba(108,99,255,0.15)' }}>
                  <span>👥</span><span>Family Njangi</span><span className={styles.mockGreen}>Active</span>
                </div>
                <div className={styles.mockCard} style={{ background: 'rgba(22,163,74,0.1)' }}>
                  <span>💰</span><span>Payout received</span><span className={styles.mockGreen}>+50,000 XAF</span>
                </div>
                <div className={styles.mockCard} style={{ background: 'rgba(234,179,8,0.1)' }}>
                  <span>🎯</span><span>School fees goal</span><span>68%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className={styles.statsBar}>
        {STATS.map(s => (
          <div key={s.label} className={styles.statItem}>
            <div className={styles.statValue}>{s.value}</div>
            <div className={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </section>

      {/* ── How it works ── */}
      <section className={styles.section} id="how">
        <div className={styles.sectionInner}>
          <div className={styles.sectionTag}>Simple Process</div>
          <h2 className={styles.sectionTitle}>How Via Works</h2>
          <p className={styles.sectionSub}>Get started in minutes. No bank account required.</p>
          <div className={styles.stepsGrid}>
            {HOW_IT_WORKS.map((s, i) => (
              <div key={s.n} className={styles.step}>
                <div className={styles.stepNum}>{s.n}</div>
                {i < HOW_IT_WORKS.length - 1 && <div className={styles.stepLine} />}
                <div className={styles.stepTitle}>{s.t}</div>
                <div className={styles.stepDesc}>{s.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className={`${styles.section} ${styles.sectionAlt}`} id="features">
        <div className={styles.sectionInner}>
          <div className={styles.sectionTag}>Everything You Need</div>
          <h2 className={styles.sectionTitle}>Built for Your Community</h2>
          <p className={styles.sectionSub}>From traditional savings circles to personal goals — Via handles it all.</p>
          <div className={styles.featuresGrid}>
            {FEATURES.map(f => (
              <div key={f.title} className={styles.featureCard}>
                <div className={styles.featureIcon}>{f.icon}</div>
                <div className={styles.featureTitle}>{f.title}</div>
                <div className={styles.featureDesc}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className={styles.ctaBanner}>
        <div className={styles.ctaBannerInner}>
          <h2>Ready to start saving smarter?</h2>
          <p>Join thousands of people across Africa using Via to save together.</p>
          <div className={styles.heroCtas}>
            <Link to="/register" className={styles.ctaPrimary}>Create Free Account</Link>
            <Link to="/login" className={styles.ctaSecondaryWhite}>Sign In</Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <ViaLogo size={32} forceMode="dark" />
            <span className={styles.footerBrandName}>Via</span>
            <span className={styles.footerTagline}>Save Together. Grow Together.</span>
          </div>
          <div className={styles.footerLinks}>
            <Link to="/about">About</Link>
            <Link to="/help">Help Center</Link>
            <Link to="/register">Sign Up</Link>
            <Link to="/login">Sign In</Link>
          </div>
          <div className={styles.footerCopy}>
            © {new Date().getFullYear()} Via. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
