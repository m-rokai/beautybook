export const services = [
  {
    id: 'signature-facial',
    name: 'Signature Glow Facial',
    description: 'A 60-minute reset focused on brightening, hydration, and gentle exfoliation.',
    duration: '60 min',
    price: '$145',
    deposit: '$45',
    cancellationFee: '$35',
  },
  {
    id: 'acne-clarity',
    name: 'Acne Clarity Treatment',
    description: 'Targeted congestion support with extractions, LED time, and a home-care plan.',
    duration: '75 min',
    price: '$165',
    deposit: '$55',
    cancellationFee: '$40',
  },
  {
    id: 'dermaplane',
    name: 'Dermaplane + Peel',
    description: 'A texture-smoothing treatment for guests looking for immediate polish before events.',
    duration: '50 min',
    price: '$185',
    deposit: '$65',
    cancellationFee: '$50',
  },
  {
    id: 'brow-lash',
    name: 'Brow + Lash Refresh',
    description: 'Quick appointment for brow shaping, tinting, or lash lift touch-up.',
    duration: '40 min',
    price: '$95',
    deposit: '$30',
    cancellationFee: '$25',
  },
];

export const slotGroups = [
  {
    id: 'thu',
    day: 'Thursday',
    caption: 'Ideal for lunch-break or after-work appointments.',
    slots: [
      { id: 'thu-10', label: '10:00 AM', dateLabel: 'Thu, March 20', status: 'Available' },
      { id: 'thu-1230', label: '12:30 PM', dateLabel: 'Thu, March 20', status: 'Almost full' },
      { id: 'thu-430', label: '4:30 PM', dateLabel: 'Thu, March 20', status: 'Available' },
    ],
  },
  {
    id: 'fri',
    day: 'Friday',
    caption: 'Strong demand from Muze members before the weekend.',
    slots: [
      { id: 'fri-9', label: '9:00 AM', dateLabel: 'Fri, March 21', status: 'Available' },
      { id: 'fri-11', label: '11:00 AM', dateLabel: 'Fri, March 21', status: 'Prime slot' },
      { id: 'fri-230', label: '2:30 PM', dateLabel: 'Fri, March 21', status: 'Available' },
    ],
  },
  {
    id: 'sat',
    day: 'Saturday',
    caption: 'Weekend demand supports premium services and add-ons.',
    slots: [
      { id: 'sat-930', label: '9:30 AM', dateLabel: 'Sat, March 22', status: 'Waitlist likely' },
      { id: 'sat-12', label: '12:00 PM', dateLabel: 'Sat, March 22', status: 'Available' },
      { id: 'sat-3', label: '3:00 PM', dateLabel: 'Sat, March 22', status: 'Available' },
    ],
  },
];

export const bookingPolicies = [
  { id: 'deposit', label: 'Deposit', value: 'Required to secure slot' },
  { id: 'late-cancel', label: 'Late cancel', value: '50% of service inside 24 hours' },
  { id: 'no-show', label: 'No-show', value: '100% of deposit forfeited' },
  { id: 'reschedule', label: 'Reschedule', value: 'Free outside 24 hours' },
];

export const dashboardStats = {
  weeklyRevenue: '$3,860',
  bookedThisWeek: '28 bookings',
  retentionPipeline: '12 guests due for follow-up',
  cards: [
    {
      label: 'This week booked',
      value: '$3,860',
      detail: 'Includes deposits, completed services, and cancellation fees.',
    },
    {
      label: 'Occupancy',
      value: '82%',
      detail: 'Healthy fill rate across the esthetician calendar.',
    },
    {
      label: 'Repeat guest rate',
      value: '61%',
      detail: 'Strong base for recurring facial memberships and add-ons.',
    },
    {
      label: 'Fees recovered',
      value: '$245',
      detail: 'Cancellation policy enforcement through Stripe payment methods.',
    },
  ],
};

export const todaysAppointments = [
  {
    id: 'apt-1',
    customer: 'Ashley Lacy',
    contact: 'ashley@example.com',
    service: 'Signature Glow Facial',
    amount: '$145',
    time: '10:00 AM',
    date: 'Thu, March 20',
    status: 'confirmed',
  },
  {
    id: 'apt-2',
    customer: 'Jaz Monroe',
    contact: 'jaz@example.com',
    service: 'Acne Clarity Treatment',
    amount: '$165',
    time: '12:30 PM',
    date: 'Thu, March 20',
    status: 'pending',
  },
  {
    id: 'apt-3',
    customer: 'Leah Warren',
    contact: 'leah@example.com',
    service: 'Dermaplane + Peel',
    amount: '$185',
    time: '4:30 PM',
    date: 'Thu, March 20',
    status: 'confirmed',
  },
];

export const weeklyRevenue = [
  { day: 'Monday', total: '$540', note: 'Good morning fill driven by member discounts.' },
  { day: 'Tuesday', total: '$675', note: 'Package upgrades converted well after follow-up reminders.' },
  { day: 'Wednesday', total: '$490', note: 'Open capacity midday for quick brow and lash services.' },
  { day: 'Thursday', total: '$935', note: 'Prime day for premium facials and pre-weekend prep.' },
  { day: 'Friday', total: '$1,220', note: 'Highest demand window with strong repeat customer mix.' },
];

export const customerRoster = [
  {
    id: 'cust-1',
    name: 'Ashley Lacy',
    email: 'ashley@example.com',
    segment: 'VIP',
    story: 'Books monthly glow facials and usually adds retail after checkout.',
    lifetimeSpend: '$1,480',
    lastVisit: 'February 28',
    nextAction: 'Send loyalty bonus after next completed appointment.',
  },
  {
    id: 'cust-2',
    name: 'Jaz Monroe',
    email: 'jaz@example.com',
    segment: 'Win-back',
    story: 'Interested in acne support but has rescheduled twice due to work conflicts.',
    lifetimeSpend: '$520',
    lastVisit: 'January 14',
    nextAction: 'Offer weekday recovery slot and reminder sequence.',
  },
  {
    id: 'cust-3',
    name: 'Leah Warren',
    email: 'leah@example.com',
    segment: 'New',
    story: 'First treatment this month, likely candidate for dermaplane maintenance plan.',
    lifetimeSpend: '$185',
    lastVisit: 'March 12',
    nextAction: 'Send aftercare guide and 4-week rebook nudge.',
  },
];

export const retentionAutomations = [
  {
    title: '24-hour reminder',
    copy: 'Resend email with arrival details, prep notes, and a quick link to change or cancel.',
    trigger: '24 hours before appointment',
  },
  {
    title: 'Post-treatment aftercare',
    copy: 'Deliver product suggestions, booking recap, and next-step guidance automatically.',
    trigger: '2 hours after completed appointment',
  },
  {
    title: 'Four-week rebook prompt',
    copy: 'Invite facial clients to reserve their next session before skin goals cool off.',
    trigger: '28 days after service',
  },
];

export const operationalNotes = [
  {
    title: 'Supabase schema',
    body: 'Store services, provider availability, bookings, customers, payments, and cancellation events in normalized tables.',
  },
  {
    title: 'Stripe flow',
    body: 'Use Checkout or Payment Element to collect deposits or full payments, then store the payment intent and customer ID for future fees.',
  },
  {
    title: 'Resend messaging',
    body: 'Send branded confirmations, reminders, cancellation notices, and retention campaigns with Muze Office styling.',
  },
];

export const customerAppointments = [
  {
    id: 'guest-1',
    code: 'MUZE-ESTH-2048',
    customer: 'Ashley Lacy',
    provider: 'Ashley Lacy Aesthetics',
    service: 'Signature Glow Facial',
    date: 'Thu, March 20',
    time: '10:00 AM',
    paymentStatus: 'Deposit captured',
    status: 'Confirmed',
    feeNotice: '',
  },
  {
    id: 'guest-2',
    code: 'MUZE-ESTH-3321',
    customer: 'Jaz Monroe',
    provider: 'Ashley Lacy Aesthetics',
    service: 'Acne Clarity Treatment',
    date: 'Fri, March 21',
    time: '11:00 AM',
    paymentStatus: 'Deposit captured',
    status: 'Confirmed',
    feeNotice: '',
  },
];

export const customerMoments = [
  {
    title: 'Aftercare email',
    copy: 'Send treatment-specific aftercare and product recommendations with a rebook CTA.',
    trigger: 'Post-appointment via Resend',
  },
  {
    title: 'Dormant guest reactivation',
    copy: 'Spot guests who have not booked in 45 days and offer a comeback credit.',
    trigger: 'Supabase retention segment',
  },
  {
    title: 'Birthday upgrade offer',
    copy: 'Deliver a premium add-on incentive to loyalty members during birthday month.',
    trigger: 'Customer profile automation',
  },
];

export const cancellationPolicy = [
  {
    title: '24-hour flexibility',
    body: 'Guests can cancel or reschedule outside the 24-hour window with no penalty.',
  },
  {
    title: 'Late cancellation fee',
    body: 'Inside 24 hours, Muze Office can charge a defined late cancellation fee through Stripe.',
  },
  {
    title: 'No-show protection',
    body: 'Deposits or pre-authorized payment methods prevent silent revenue loss from missed appointments.',
  },
];

export const platformPartners = [
  { key: 'supabase', name: 'Supabase' },
  { key: 'stripe', name: 'Stripe' },
  { key: 'resend', name: 'Resend' },
  { key: 'vercel', name: 'Vercel' },
];
