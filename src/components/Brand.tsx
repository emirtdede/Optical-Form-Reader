import type { SVGProps } from 'react';

export function ProductMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 256 256" role="img" aria-label="Optik Form Okuyucu logosu" {...props}>
      <defs>
        <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
        <linearGradient id="laserGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0" />
          <stop offset="15%" stopColor="#2dd4bf" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#2dd4bf" stopOpacity="1" />
          <stop offset="85%" stopColor="#2dd4bf" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" />
        </linearGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <path d="M 40 72 L 40 40 L 72 40" fill="none" stroke="url(#brandGrad)" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M 184 40 L 216 40 L 216 72" fill="none" stroke="url(#brandGrad)" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M 40 184 L 40 216 L 72 216" fill="none" stroke="url(#brandGrad)" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M 184 216 L 216 216 L 216 184" fill="none" stroke="url(#brandGrad)" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="84" cy="84" r="14" fill="none" stroke="#475569" strokeWidth="6" />
      <circle cx="128" cy="84" r="14" fill="url(#brandGrad)" />
      <circle cx="172" cy="84" r="14" fill="none" stroke="#475569" strokeWidth="6" />
      <circle cx="84" cy="128" r="14" fill="none" stroke="#475569" strokeWidth="6" />
      <circle cx="128" cy="128" r="14" fill="none" stroke="#475569" strokeWidth="6" />
      <circle cx="172" cy="128" r="14" fill="url(#brandGrad)" />
      <circle cx="84" cy="172" r="14" fill="url(#brandGrad)" />
      <circle cx="128" cy="172" r="14" fill="none" stroke="#475569" strokeWidth="6" />
      <circle cx="172" cy="172" r="14" fill="none" stroke="#475569" strokeWidth="6" />
      <rect x="20" y="126" width="216" height="4" fill="url(#laserGrad)" filter="url(#glow)" opacity="0.9" />
    </svg>
  );
}

export function VelliumMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 145 1024 818" role="img" aria-label="Vellium logosu" {...props}>
      <g transform="translate(0 1024) scale(.1 -.1)" fill="currentColor">
        <path d="M53 8745c-34-24-29-64 12-112 52-61 101-80 235-93 410-38 673-149 923-389 161-155 293-332 442-591 106-186 1284-2552 2777-5580 621-1260 655-1327 674-1334 22-8 47 38 236 422 773 1576 1151 2344 1548 3147 117 237 259 525 315 640 350 715 1261 2549 1313 2643 256 465 528 758 836 903 161 75 298 110 530 135 175 19 214 32 266 91 46 53 53 93 18 117-27 19-189 21-718 6-626-18-768-30-1008-86-260-61-467-156-682-313-97-71-300-274-374-374-147-198-178-257-674-1272-115-236-373-761-572-1165-200-404-504-1023-676-1375-369-754-336-690-354-690-8 0-67 106-141 255-185 368-886 1784-1431 2890-469 952-541 1092-626 1225-287 449-705 733-1233 839-228 46-487 61-1203 72-373 5-413 5-433-11Zm1717-370c184-30 402-121 560-234 171-121 350-325 463-527 55-99 606-1204 1367-2744 608-1230 930-1873 946-1890 12-13 16-13 28 0 13 13 278 547 751 1515 62 127 240 487 395 800 155 314 331 669 390 790 355 726 736 1487 780 1560 166 275 368 471 615 597 207 105 451 166 553 139 76-21 66-62-72-288-85-140-211-382-396-758-92-187-353-713-580-1170-792-1595-1317-2664-1742-3550-399-830-687-1410-702-1413-20-4-297 544-701 1388-430 899-2542 5154-2657 5355-26 44-80 137-121 208-86 146-94 169-73 202 24 37 64 41 196 20Z" />
      </g>
    </svg>
  );
}
