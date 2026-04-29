import React, { useState } from 'react';
import styles from './TermsModal.module.css';

const TERMS = {
  member_joining: {
    title: 'Before You Join',
    icon: '📋',
    body: [
      'Please read and understand the following before joining this savings group.',
    ],
    points: [
      'Once you join and the circle begins, you are committed for the entire circle — you cannot leave mid-circle.',
      'You must make your contribution on time every cycle. Missing contributions affects all other members.',
      'You can only leave the group during the re-forming phase, after a full circle has been completed.',
      'If you leave during re-forming, you forfeit your membership permanently and will not be part of the next circle.',
      'By joining, you agree to the group\'s contribution amount and schedule as set by the admin.',
    ],
    warning: 'Only join if you are confident you can commit to the full circle.',
  },
  admin_approval: {
    title: 'Admin Responsibility — Member Approval',
    icon: '⚖️',
    body: [
      'By approving this member, you are personally vouching for their participation in this savings group.',
      'As the approving admin, you acknowledge and accept the following responsibilities:',
    ],
    points: [
      'You are responsible for ensuring this member understands and agrees to the group\'s contribution rules.',
      'If this member fails to make contributions on time, you may be held accountable by other group members.',
      'If this member causes financial harm to the group (e.g. defaults on contributions after receiving a payout), you bear partial moral and social responsibility for their actions.',
      'You confirm that you know this person and believe they are trustworthy enough to participate in this group.',
      'This approval is final — you cannot undo it once confirmed.',
    ],
    warning: 'Only approve members you personally trust and can vouch for.',
  },
  invite_vouching: {
    title: 'Inviter Responsibility — Member Vouching',
    icon: '🤝',
    body: [
      'By sharing your invite link with this person, you are vouching for them as a trustworthy member of this savings group.',
      'As the person who invited them, you acknowledge and accept the following:',
    ],
    points: [
      'You personally know this individual and believe they are reliable and financially responsible.',
      'You understand that your reputation within the group is tied to the behaviour of people you invite.',
      'If the person you invited fails to contribute or causes harm to the group, other members may hold you accountable.',
      'You are responsible for informing the person you invite about the group\'s rules and expectations before they join.',
      'Your invite link is personal — do not share it publicly or with people you do not know well.',
    ],
    warning: 'Only invite people you personally know and trust.',
  },
};

const FREQUENCY_OPTIONS = [
  { value: 'every_time', label: 'Every time', desc: 'Always show this reminder before I approve or invite' },
  { value: 'per_group',  label: 'Once per group', desc: 'Show once per group, then remember my acceptance' },
  { value: 'never',      label: 'Don\'t show again', desc: 'I understand my responsibilities — don\'t remind me' },
];

export default function TermsModal({ type, groupId, memberName, onAccept, onCancel }) {
  const terms = TERMS[type];
  const [frequency, setFrequency] = useState('every_time');
  const [checked, setChecked]     = useState(false);

  if (!terms) return null;

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        <div className={styles.header}>
          <span className={styles.icon}>{terms.icon}</span>
          <h2 className={styles.title}>{terms.title}</h2>
          {memberName && <p className={styles.memberName}>For: <strong>{memberName}</strong></p>}
        </div>

        <div className={styles.body}>
          {terms.body.map((p, i) => <p key={i} className={styles.intro}>{p}</p>)}
          <ul className={styles.points}>
            {terms.points.map((p, i) => (
              <li key={i} className={styles.point}>
                <span className={styles.bullet}>•</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <div className={styles.warning}>
            <span>⚠️</span>
            <span>{terms.warning}</span>
          </div>
        </div>

        {/* Reminder frequency preference — not shown for member joining */}
        {type !== 'member_joining' && (
          <div className={styles.frequencySection}>
            <p className={styles.frequencyLabel}>How often would you like to see this reminder?</p>
            <div className={styles.frequencyOptions}>
              {FREQUENCY_OPTIONS.map(opt => (
                <label key={opt.value} className={`${styles.freqOption} ${frequency === opt.value ? styles.freqActive : ''}`}>
                  <input type="radio" name="frequency" value={opt.value} checked={frequency === opt.value} onChange={() => setFrequency(opt.value)} />
                  <div>
                    <div className={styles.freqLabel}>{opt.label}</div>
                    <div className={styles.freqDesc}>{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Checkbox confirmation */}
        <label className={styles.checkRow}>
          <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />
          <span>I have read and understood my responsibilities. I accept these terms.</span>
        </label>

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
          <button className={styles.acceptBtn} disabled={!checked} onClick={() => onAccept(frequency)}>
            {type === 'member_joining' ? 'I Agree — Join Group' : 'Accept & Proceed'}
          </button>
        </div>
      </div>
    </div>
  );
}
