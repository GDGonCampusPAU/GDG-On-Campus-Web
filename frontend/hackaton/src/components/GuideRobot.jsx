import './GuideRobot.css'

const FILL = '#1b1e23'

/**
 * The 404 page's robot, drawn in light lines for a dark laptop screen.
 * Its poses are CSS states, so it moves between them:
 * - `talk`: standing, waving, blinking
 * - `lying`: stretched out on the floor of the screen, eyes closed, humming
 * - `upset`: back on its feet, cross and a bit sad (frown, angry brows, a tear)
 * @param {{ mood: 'talk' | 'lying' | 'upset', className?: string }} props
 */
export default function GuideRobot({ mood, className = '' }) {
  return (
    <svg className={`guide-robot is-${mood} ${className}`.trim()} viewBox="0 0 400 330" aria-hidden="true">
      <defs>
        <g id="guide-robot-cog">
          <circle r="13" fill="none" stroke="currentColor" strokeWidth="7" strokeDasharray="4.2 4" />
          <circle r="10" fill={FILL} stroke="currentColor" strokeWidth="2.5" />
          <circle r="3" fill="currentColor" />
        </g>
      </defs>

      <ellipse className="guide-robot__floor" cx="200" cy="314" rx="170" ry="9" fill="#ffffff" fillOpacity=".07" />

      {/* Lying: a pillow under the head, humming while it waits. */}
      <path className="guide-robot__pillow" d="M58 312 q-6 -22 20 -24 h90 q24 2 18 24 z" fill="#2a2e35" stroke="currentColor" strokeWidth="2.5" />
      <g className="guide-robot__notes" fill="currentColor" fontFamily="var(--font-sans)" fontWeight="700">
        <text x="40" y="118" fontSize="28">♪</text>
        <text x="74" y="86" fontSize="22">♫</text>
      </g>

      <g className="guide-robot__body" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        {/* legs */}
        <path d="M172 248 V284" strokeWidth="22" />
        <path d="M172 248 V284" stroke={FILL} strokeWidth="16" />
        <path d="M228 248 V284" strokeWidth="22" />
        <path d="M228 248 V284" stroke={FILL} strokeWidth="16" />
        <rect x="140" y="282" width="56" height="26" rx="8" fill={FILL} />
        <rect x="204" y="282" width="56" height="26" rx="8" fill={FILL} />

        {/* left arm, down */}
        <g className="guide-robot__arm-l">
          <path d="M138 170 C118 182 108 205 104 228" strokeWidth="20" />
          <path d="M138 170 C118 182 108 205 104 228" stroke={FILL} strokeWidth="14" />
          <circle cx="104" cy="232" r="11" fill={FILL} />
        </g>

        {/* right arm: waves, stretches over the head when lying, drops to the hip when upset */}
        <g className="guide-robot__arm-r">
          <path d="M262 170 C292 162 312 140 316 114" strokeWidth="20" />
          <path d="M262 170 C292 162 312 140 316 114" stroke={FILL} strokeWidth="14" />
          <circle cx="316" cy="108" r="12" fill={FILL} />
          <path d="M308 98 v-6 M316 96 v-8 M324 98 v-6" strokeWidth="2.5" />
        </g>

        {/* body */}
        <rect x="134" y="140" width="132" height="112" rx="10" fill={FILL} />
        <rect x="158" y="156" width="84" height="62" rx="4" fill="#111316" />
        <g transform="translate(186 186)">
          <use href="#guide-robot-cog" className="guide-robot__gear" />
        </g>
        <g transform="translate(218 198) scale(.8)">
          <use href="#guide-robot-cog" className="guide-robot__gear guide-robot__gear--back" />
        </g>
        <circle cx="168" cy="236" r="4" fill="#4285f4" stroke="none" />
        <circle cx="182" cy="236" r="4" fill="#ea4335" stroke="none" />
        <circle cx="196" cy="236" r="4" fill="#f9ab00" stroke="none" />
        <circle cx="210" cy="236" r="4" fill="#34a853" stroke="none" />
        <rect x="246" y="226" width="12" height="18" rx="3" strokeWidth="2" />
        <rect x="188" y="130" width="24" height="12" fill={FILL} />

        {/* head */}
        <g className="guide-robot__head">
          <path d="M200 40 V22" />
          <circle cx="200" cy="18" r="6" fill="#f9ab00" />
          <rect x="124" y="64" width="18" height="36" rx="4" fill={FILL} />
          <rect x="258" y="64" width="18" height="36" rx="4" fill={FILL} />
          <rect x="140" y="40" width="120" height="92" rx="10" fill={FILL} />

          <g className="guide-robot__eyes">
            <circle cx="178" cy="84" r="10" fill={FILL} />
            <circle cx="179" cy="85" r="4" fill="currentColor" />
            <circle cx="222" cy="84" r="10" fill={FILL} />
            <circle cx="223" cy="85" r="4" fill="currentColor" />
          </g>
          <path className="guide-robot__eyes-closed" d="M168 86 q10 7 20 0 M212 86 q10 7 20 0" />

          <path className="guide-robot__brows-calm" d="M166 66 q12 -6 24 -2 M210 64 q12 -4 24 2" />
          <path className="guide-robot__brows-cross" d="M166 62 l24 9 M210 71 l24 -9" />

          <path className="guide-robot__mouth-smile" d="M182 108 q18 14 36 0" />
          <path className="guide-robot__mouth-frown" d="M182 116 q18 -12 36 0" />

          {/* upset: a tear and an anger mark */}
          <path className="guide-robot__tear" d="M168 98 q-5 9 0 13 q5 -4 0 -13 z" fill="#57caff" stroke="#57caff" strokeWidth="1.5" />
          <path className="guide-robot__cross-mark" d="M268 34 q6 4 0 10 M276 26 q-4 6 2 10 M286 34 q-6 4 0 10 M278 48 q4 -6 -2 -10" stroke="#ea4335" strokeWidth="3" />
        </g>
      </g>
    </svg>
  )
}
