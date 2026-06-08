import logoLight from '../pages/logo-light.png';

export default function ViaLogo({ size = 64, className = '' }) {
  return (
    <div
      className={className}
      style={{
        width:        size,
        height:       size,
        borderRadius: Math.round(size * 0.28),
        overflow:     'hidden',
        flexShrink:   0,
        display:      'inline-block',
        lineHeight:   0,
      }}
    >
      <img
        src={logoLight}
        alt="Via"
        style={{
          width:          '100%',
          height:         '100%',
          objectFit:      'cover',
          objectPosition: 'center',
          display:        'block',
        }}
      />
    </div>
  );
}
