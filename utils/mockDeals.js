const crypto = require('crypto');

function makeId(slug, title) {
  return crypto.createHash('sha256').update(slug + '|' + title).digest('hex').slice(0, 16);
}

function futureDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const MOCK_DATA = {
  marriott: [
    { title: 'Member Rate: Up to 35% Off', description: 'Book as a Marriott Bonvoy member and save up to 35% on your stay at thousands of properties worldwide.', discount: 'Up to 35% Off', discountPct: 35, validUntil: futureDate(30), tags: ['member', 'worldwide'], bookingUrl: 'https://www.marriott.com/deals/hotel-deals.mi' },
    { title: 'Advance Purchase — Save 20%', description: 'Plan ahead and save 20% when you book at least 7 days in advance. Non-refundable rate applies.', discount: '20% Off', discountPct: 20, validUntil: futureDate(60), tags: ['early bird', 'advance purchase'], bookingUrl: 'https://www.marriott.com/deals/hotel-deals.mi' },
    { title: 'Weekend Escape Package', description: 'Enjoy exclusive weekend rates at select Marriott properties including breakfast for two guests.', discount: 'Up to 25% Off', discountPct: 25, validUntil: futureDate(14), tags: ['weekend', 'breakfast'], bookingUrl: 'https://www.marriott.com/deals/hotel-deals.mi' },
  ],
  hilton: [
    { title: 'Hilton Honors Member Saver', description: 'Exclusive rate for Hilton Honors members — up to 30% off your next stay at any Hilton brand.', discount: 'Up to 30% Off', discountPct: 30, validUntil: futureDate(30), tags: ['member', 'honors'], bookingUrl: 'https://www.hilton.com/en/hilton-honors/deals/' },
    { title: '72-Hour Flash Sale', description: 'Limited-time flash sale: save up to 40% at select Hilton properties for stays this season.', discount: 'Up to 40% Off', discountPct: 40, validUntil: futureDate(5), tags: ['last-minute', 'flash sale'], bookingUrl: 'https://www.hilton.com/en/hilton-honors/deals/' },
    { title: 'Park Sleep Fly Deal', description: 'Stay near the airport, park your car, and fly — all in one convenient and affordable package.', discount: 'From $89/night', discountPct: 15, validUntil: futureDate(60), tags: ['airport', 'package'], bookingUrl: 'https://www.hilton.com/en/hilton-honors/deals/' },
  ],
  ihg: [
    { title: 'IHG One Rewards Rate', description: 'Members unlock exclusive rates up to 30% off across all IHG brands at 6,000+ hotels worldwide.', discount: 'Up to 30% Off', discountPct: 30, validUntil: futureDate(30), tags: ['member', 'one rewards'], bookingUrl: 'https://www.ihg.com/hotels/us/en/offers' },
    { title: 'Book Early & Save', description: 'Secure your preferred dates up to 60 days in advance and save 20% on your room rate.', discount: '20% Off', discountPct: 20, validUntil: futureDate(60), tags: ['early bird', 'advance purchase'], bookingUrl: 'https://www.ihg.com/hotels/us/en/offers' },
    { title: 'Stay Longer Save More', description: 'Stay 3+ nights and enjoy up to 25% off. Extended stays include complimentary breakfast at select properties.', discount: 'Up to 25% Off', discountPct: 25, validUntil: futureDate(30), tags: ['extended stay', 'breakfast'], bookingUrl: 'https://www.ihg.com/hotels/us/en/offers' },
  ],
  hyatt: [
    { title: 'World of Hyatt Member Rate', description: 'Join World of Hyatt for free and unlock members-only rates up to 35% off at properties worldwide.', discount: 'Up to 35% Off', discountPct: 35, validUntil: futureDate(30), tags: ['member', 'world of hyatt'], bookingUrl: 'https://www.hyatt.com/offers' },
    { title: 'Advance Purchase Deal', description: 'Save up to 20% when you book your stay at least 2 weeks ahead. Prepaid, non-refundable rate.', discount: 'Up to 20% Off', discountPct: 20, validUntil: futureDate(60), tags: ['advance purchase', 'early bird'], bookingUrl: 'https://www.hyatt.com/offers' },
    { title: 'Family Summer Package', description: 'Kids eat free and enjoy complimentary rollaway beds at select Hyatt Regency properties this summer.', discount: 'Up to 25% Off', discountPct: 25, validUntil: futureDate(45), tags: ['family', 'summer'], bookingUrl: 'https://www.hyatt.com/offers' },
  ],
  accor: [
    { title: 'ALL Member Exclusive Rate', description: 'Accor Live Limitless members save up to 30% off flexible rates at 5,600+ hotels across 110 countries.', discount: 'Up to 30% Off', discountPct: 30, validUntil: futureDate(30), tags: ['member', 'ALL'], bookingUrl: 'https://all.accor.com/promotions/index.en.shtml' },
    { title: 'Dinner & Stay Package', description: 'Dine at the hotel restaurant and enjoy a complimentary room upgrade at select Accor hotels.', discount: 'Up to 20% Off', discountPct: 20, validUntil: futureDate(30), tags: ['dining', 'upgrade'], bookingUrl: 'https://all.accor.com/promotions/index.en.shtml' },
    { title: 'Flash Deal: Weekend Only', description: 'Weekend flash offer — save up to 35% at participating Sofitel, Novotel and Mercure properties.', discount: 'Up to 35% Off', discountPct: 35, validUntil: futureDate(6), tags: ['weekend', 'flash sale', 'last-minute'], bookingUrl: 'https://all.accor.com/promotions/index.en.shtml' },
  ],
  banyantree: [
    { title: 'Tropical Escape Package', description: 'Immerse yourself in tropical luxury with daily breakfast, spa credit, and sunset cocktails included.', discount: 'Up to 30% Off', discountPct: 30, validUntil: futureDate(30), tags: ['spa', 'breakfast', 'luxury'], bookingUrl: 'https://www.banyantree.com/en/offers' },
    { title: 'Sanctuary Retreat — Stay 4 Pay 3', description: 'Stay 4 nights and pay for only 3 at select Banyan Tree resorts. Includes daily spa access.', discount: 'Stay 4 Pay 3', discountPct: 25, validUntil: futureDate(60), tags: ['spa', 'resort', 'long stay'], bookingUrl: 'https://www.banyantree.com/en/offers' },
    { title: 'Romance & Wellness Escape', description: 'Couples package with signature spa treatment, romantic dinner, and guaranteed late checkout.', discount: 'Up to 20% Off', discountPct: 20, validUntil: futureDate(30), tags: ['spa', 'romance', 'couple'], bookingUrl: 'https://www.banyantree.com/en/offers' },
  ],
  wyndham: [
    { title: 'Wyndham Rewards Rate', description: 'Wyndham Rewards members earn points and save up to 25% off across 9,000+ properties worldwide.', discount: 'Up to 25% Off', discountPct: 25, validUntil: futureDate(30), tags: ['member', 'rewards'], bookingUrl: 'https://www.wyndhamhotels.com/offers' },
    { title: 'Go Free — Points Stay', description: 'Redeem your Wyndham Rewards points for complimentary nights at select properties across all brands.', discount: 'Free Night', discountPct: 30, validUntil: futureDate(60), tags: ['points', 'free night'], bookingUrl: 'https://www.wyndhamhotels.com/offers' },
    { title: 'Road Trip Special', description: 'Save 15% when you book 3+ nights along your road trip route at participating Wyndham properties.', discount: '15% Off', discountPct: 15, validUntil: futureDate(60), tags: ['road trip', 'extended stay'], bookingUrl: 'https://www.wyndhamhotels.com/offers' },
  ],
  bestwestern: [
    { title: 'Best Western Rewards Saver', description: 'Best Western Rewards members enjoy exclusive rates and earn points every stay at 4,000+ hotels.', discount: 'Up to 20% Off', discountPct: 20, validUntil: futureDate(30), tags: ['member', 'rewards'], bookingUrl: 'https://www.bestwestern.com/en_US/hotels/deals-and-offers.html' },
    { title: 'AAA/CAA Member Deal', description: 'Show your AAA/CAA card at check-in and save 10% off the best available rate. Free breakfast at select hotels.', discount: '10% Off', discountPct: 10, validUntil: futureDate(60), tags: ['AAA', 'breakfast'], bookingUrl: 'https://www.bestwestern.com/en_US/hotels/deals-and-offers.html' },
    { title: 'Summer Value Package', description: 'Great summer rates with complimentary Wi-Fi, free parking, and kids stay free at select properties.', discount: 'Up to 15% Off', discountPct: 15, validUntil: futureDate(60), tags: ['summer', 'family'], bookingUrl: 'https://www.bestwestern.com/en_US/hotels/deals-and-offers.html' },
  ],
  choicehotels: [
    { title: 'Choice Privileges Member Rate', description: 'Earn points faster with member rates — up to 20% off across 7,000+ Choice Hotels properties.', discount: 'Up to 20% Off', discountPct: 20, validUntil: futureDate(30), tags: ['member', 'privileges'], bookingUrl: 'https://www.choicehotels.com/deals' },
    { title: 'Extended Stay Discount', description: 'Stay 5+ nights and receive a 30% discount at Suburban Extended Stay or Mainstay Suites locations.', discount: '30% Off', discountPct: 30, validUntil: futureDate(60), tags: ['extended stay', 'suite'], bookingUrl: 'https://www.choicehotels.com/deals' },
    { title: 'Weekend Rate Special', description: 'Book a Friday–Sunday stay and save 15% on your weekend getaway at Quality Inn or Comfort Inn.', discount: '15% Off', discountPct: 15, validUntil: futureDate(21), tags: ['weekend'], bookingUrl: 'https://www.choicehotels.com/deals' },
  ],
  radisson: [
    { title: 'Radisson Rewards Rate', description: 'Radisson Rewards members save up to 25% off the best available rate at all Radisson Hotel Group properties.', discount: 'Up to 25% Off', discountPct: 25, validUntil: futureDate(30), tags: ['member', 'rewards'], bookingUrl: 'https://www.radissonhotels.com/en-us/offers' },
    { title: 'Advance Purchase — 20% Off', description: 'Book non-refundable at least 7 days ahead and save 20% on your stay at any Radisson property.', discount: '20% Off', discountPct: 20, validUntil: futureDate(60), tags: ['advance purchase', 'early bird'], bookingUrl: 'https://www.radissonhotels.com/en-us/offers' },
    { title: 'Long Stay Special', description: 'Enjoy 25% off when you book 3 or more consecutive nights at participating Radisson properties worldwide.', discount: '25% Off', discountPct: 25, validUntil: futureDate(30), tags: ['extended stay'], bookingUrl: 'https://www.radissonhotels.com/en-us/offers' },
  ],
  melia: [
    { title: 'MeliáRewards Secret Rate', description: 'Exclusive secret rates for MeliáRewards members — save up to 40% at luxury Meliá and Gran Meliá resorts.', discount: 'Up to 40% Off', discountPct: 40, validUntil: futureDate(30), tags: ['member', 'luxury', 'secret rate'], bookingUrl: 'https://www.melia.com/en/offers' },
    { title: 'All-Inclusive Summer Offer', description: 'Book an all-inclusive stay and enjoy unlimited food, drinks, and resort activities at Sol Hotels.', discount: 'Up to 25% Off', discountPct: 25, validUntil: futureDate(60), tags: ['all-inclusive', 'summer'], bookingUrl: 'https://www.melia.com/en/offers' },
    { title: 'Spa & Leisure Retreat', description: 'Pamper yourself with a 3-night spa retreat at ME by Meliá. Includes spa credit and gourmet dinner.', discount: 'Up to 20% Off', discountPct: 20, validUntil: futureDate(30), tags: ['spa', 'luxury', 'dinner'], bookingUrl: 'https://www.melia.com/en/offers' },
  ],
  kimpton: [
    { title: 'Kimpton Inner Circle Rate', description: 'Our most loyal guests enjoy exclusive rates and perks — register free for Inner Circle benefits today.', discount: 'Up to 25% Off', discountPct: 25, validUntil: futureDate(30), tags: ['member', 'inner circle', 'boutique'], bookingUrl: 'https://www.ihg.com/kimptonhotels/hotels/us/en/offers' },
    { title: 'Urban Escape Weekend', description: 'Boutique hotel weekend escape with complimentary evening wine hour and curated neighborhood dining guide.', discount: 'Up to 20% Off', discountPct: 20, validUntil: futureDate(21), tags: ['weekend', 'boutique'], bookingUrl: 'https://www.ihg.com/kimptonhotels/hotels/us/en/offers' },
    { title: 'Stay Longer, Save More', description: 'Save 15% on 3+ night stays at any Kimpton hotel. Pet-friendly rooms available — pets always welcome.', discount: '15% Off', discountPct: 15, validUntil: futureDate(60), tags: ['extended stay', 'pet-friendly'], bookingUrl: 'https://www.ihg.com/kimptonhotels/hotels/us/en/offers' },
  ],
  autograph: [
    { title: 'Autograph Collection Member Rate', description: 'Unique properties curated for their remarkable quality — Bonvoy members save up to 30% on stays.', discount: 'Up to 30% Off', discountPct: 30, validUntil: futureDate(30), tags: ['member', 'boutique', 'unique'], bookingUrl: 'https://www.marriott.com/autograph-collection/deals.mi' },
    { title: 'Cultural Destination Package', description: 'Stay at an Autograph Collection hotel with curated local cultural experiences and artisan breakfast included.', discount: 'Up to 20% Off', discountPct: 20, validUntil: futureDate(60), tags: ['culture', 'breakfast', 'local'], bookingUrl: 'https://www.marriott.com/autograph-collection/deals.mi' },
    { title: 'Advance Booking Best Rate', description: 'Lock in the best available rate by booking 14+ days ahead at any Autograph Collection property.', discount: '25% Off', discountPct: 25, validUntil: futureDate(60), tags: ['advance purchase', 'early bird'], bookingUrl: 'https://www.marriott.com/autograph-collection/deals.mi' },
  ],
  curio: [
    { title: 'Curio Collection Honors Deal', description: 'Hilton Honors members get exclusive rates at hand-selected Curio Collection independent hotels worldwide.', discount: 'Up to 25% Off', discountPct: 25, validUntil: futureDate(30), tags: ['member', 'boutique', 'independent'], bookingUrl: 'https://www.hilton.com/en/curio-collection/deals/' },
    { title: 'Local Character Stay Package', description: 'Immerse yourself in local culture with a Curio Collection property — includes breakfast and local tours.', discount: 'Up to 20% Off', discountPct: 20, validUntil: futureDate(30), tags: ['local', 'breakfast', 'culture'], bookingUrl: 'https://www.hilton.com/en/curio-collection/deals/' },
    { title: 'Weekend Discovery Rate', description: 'Discover a distinctive destination hotel this weekend and save 15% on your boutique stay.', discount: '15% Off', discountPct: 15, validUntil: futureDate(6), tags: ['weekend', 'last-minute'], bookingUrl: 'https://www.hilton.com/en/curio-collection/deals/' },
  ],
  tribute: [
    { title: 'Tribute Portfolio Bonvoy Rate', description: 'Marriott Bonvoy members earn points at Tribute Portfolio independent hotels — save up to 25%.', discount: 'Up to 25% Off', discountPct: 25, validUntil: futureDate(30), tags: ['member', 'independent'], bookingUrl: 'https://www.marriott.com/tribute-portfolio/deals.mi' },
    { title: 'Independent Spirit Package', description: 'Celebrate local culture with a Tribute Portfolio stay, including artisan breakfast and city discovery tour.', discount: 'Up to 20% Off', discountPct: 20, validUntil: futureDate(60), tags: ['culture', 'breakfast', 'local'], bookingUrl: 'https://www.marriott.com/tribute-portfolio/deals.mi' },
    { title: 'City Break Offer', description: 'Short city break rates — 2-night minimum, save 15% when booking 7 or more days ahead.', discount: '15% Off', discountPct: 15, validUntil: futureDate(45), tags: ['city', 'advance purchase'], bookingUrl: 'https://www.marriott.com/tribute-portfolio/deals.mi' },
  ],
  hardrock: [
    { title: 'Rock Your Rate Deal', description: 'Save up to 30% at Hard Rock Hotels worldwide. Includes early check-in and late checkout based on availability.', discount: 'Up to 30% Off', discountPct: 30, validUntil: futureDate(30), tags: ['music', 'lifestyle'], bookingUrl: 'https://www.hardrock.com/hotels/special-offers' },
    { title: 'All-Inclusive Rock Star Package', description: 'Go all-inclusive at Hard Rock Hotel Cancun or Punta Cana — food, premium drinks, and entertainment included.', discount: 'Up to 25% Off', discountPct: 25, validUntil: futureDate(60), tags: ['all-inclusive', 'resort', 'entertainment'], bookingUrl: 'https://www.hardrock.com/hotels/special-offers' },
    { title: 'Amplified Experience Bundle', description: 'Premium room upgrade, spa access, and nightly live entertainment with our signature Amplified package.', discount: 'Up to 20% Off', discountPct: 20, validUntil: futureDate(30), tags: ['spa', 'entertainment', 'upgrade'], bookingUrl: 'https://www.hardrock.com/hotels/special-offers' },
  ],
  motel6: [
    { title: 'Member Rate — Save More', description: 'Sign up for rewards and save up to 10% off already low rates at Motel 6 locations nationwide.', discount: 'Up to 10% Off', discountPct: 10, validUntil: futureDate(30), tags: ['member', 'budget'], bookingUrl: 'https://www.motel6.com/en/deals.html' },
    { title: 'Weekly Rate Special', description: 'Stay a week and save — weekly rates available at select Motel 6 locations with complimentary Wi-Fi.', discount: 'Up to 20% Off', discountPct: 20, validUntil: futureDate(60), tags: ['weekly', 'extended stay'], bookingUrl: 'https://www.motel6.com/en/deals.html' },
    { title: 'AAA Member Discount', description: 'AAA members save 10% at all Motel 6 locations. Simply show your card at check-in to redeem.', discount: '10% Off', discountPct: 10, validUntil: futureDate(60), tags: ['AAA', 'budget'], bookingUrl: 'https://www.motel6.com/en/deals.html' },
  ],
  extendedstay: [
    { title: 'Weekly Rates from $299', description: 'Fully equipped studio suites with full kitchenette — perfect for work trips or temporary relocations.', discount: 'From $299/wk', discountPct: 20, validUntil: futureDate(60), tags: ['extended stay', 'weekly', 'kitchenette'], bookingUrl: 'https://www.extendedstayamerica.com/deals' },
    { title: 'Monthly Stay Discount', description: 'Book a month or more and save up to 30% on nightly rates at any Extended Stay America location.', discount: 'Up to 30% Off', discountPct: 30, validUntil: futureDate(60), tags: ['monthly', 'extended stay'], bookingUrl: 'https://www.extendedstayamerica.com/deals' },
    { title: 'Corporate Rate Program', description: 'Enroll in our corporate rate program and save up to 25% on extended business travel stays nationwide.', discount: 'Up to 25% Off', discountPct: 25, validUntil: futureDate(60), tags: ['corporate', 'business'], bookingUrl: 'https://www.extendedstayamerica.com/deals' },
  ],
  laquinta: [
    { title: 'La Quinta Returns Rate', description: 'La Quinta Returns members earn free nights and enjoy exclusive member rates up to 20% off.', discount: 'Up to 20% Off', discountPct: 20, validUntil: futureDate(30), tags: ['member', 'returns'], bookingUrl: 'https://www.laquinta.com/hotel-deals' },
    { title: 'Advance Purchase Deal', description: 'Plan ahead — book 7 days or more in advance and save 15% off your next La Quinta stay.', discount: '15% Off', discountPct: 15, validUntil: futureDate(60), tags: ['advance purchase', 'early bird'], bookingUrl: 'https://www.laquinta.com/hotel-deals' },
    { title: 'Pet-Friendly Stay Special', description: 'Pets stay free at La Quinta. Book our pet-friendly special and save 10% on select dates.', discount: '10% Off', discountPct: 10, validUntil: futureDate(30), tags: ['pet-friendly', 'budget'], bookingUrl: 'https://www.laquinta.com/hotel-deals' },
  ],
  redroof: [
    { title: 'RediCard Member Rate', description: 'Join RediCard for free and save up to 15% on every Red Roof Inn stay at 600+ locations.', discount: 'Up to 15% Off', discountPct: 15, validUntil: futureDate(30), tags: ['member', 'RediCard'], bookingUrl: 'https://www.redroof.com/deals' },
    { title: 'Extended Stay Value', description: 'Stay 5+ nights and save 20% on your total stay at any Red Roof Inn location nationwide.', discount: '20% Off', discountPct: 20, validUntil: futureDate(60), tags: ['extended stay', 'value'], bookingUrl: 'https://www.redroof.com/deals' },
    { title: 'Summer Road Trip Rate', description: 'Hit the road this summer and save — road trip rates starting at $49/night at select properties.', discount: 'From $49/night', discountPct: 15, validUntil: futureDate(45), tags: ['road trip', 'summer', 'budget'], bookingUrl: 'https://www.redroof.com/deals' },
  ],
  studio6: [
    { title: 'Weekly Rate Special', description: 'Studio 6 extended stay suites with full kitchen — weekly rates from $249 for comfortable budget living.', discount: 'From $249/wk', discountPct: 20, validUntil: futureDate(60), tags: ['extended stay', 'weekly', 'kitchen'], bookingUrl: 'https://www.staystudio6.com/en/deals.html' },
    { title: 'Monthly Discount', description: 'Stay a full month and enjoy up to 30% off our standard nightly rates at all Studio 6 locations.', discount: 'Up to 30% Off', discountPct: 30, validUntil: futureDate(60), tags: ['monthly', 'extended stay'], bookingUrl: 'https://www.staystudio6.com/en/deals.html' },
    { title: 'Value Plus Package', description: 'Budget-friendly extended stay with complimentary Wi-Fi, fully equipped kitchen, and pet-friendly rooms available.', discount: 'Up to 15% Off', discountPct: 15, validUntil: futureDate(30), tags: ['budget', 'pet-friendly', 'wifi'], bookingUrl: 'https://www.staystudio6.com/en/deals.html' },
  ],
};

function generate(chainMeta) {
  const { slug, name, tier } = chainMeta;
  const templates = MOCK_DATA[slug] || [
    { title: `${name} Member Rate`, description: `Save on your next stay at ${name} with our exclusive member discount.`, discount: 'Up to 20% Off', discountPct: 20, validUntil: futureDate(30), tags: ['member'], bookingUrl: `https://www.${slug}.com/deals` },
    { title: `${name} Advance Purchase`, description: `Book early and save at ${name} hotels worldwide.`, discount: '15% Off', discountPct: 15, validUntil: futureDate(60), tags: ['advance purchase'], bookingUrl: `https://www.${slug}.com/deals` },
    { title: `${name} Weekend Special`, description: `Enjoy a weekend getaway at ${name} with exclusive limited-time rates.`, discount: '10% Off', discountPct: 10, validUntil: futureDate(14), tags: ['weekend'], bookingUrl: `https://www.${slug}.com/deals` },
  ];

  const scrapedAt = new Date().toISOString();

  return templates.map(t => ({
    id: makeId(slug, t.title),
    chain: name,
    chainSlug: slug,
    tier,
    title: t.title,
    description: t.description,
    discount: t.discount,
    discountPct: t.discountPct,
    validFrom: null,
    validUntil: t.validUntil || null,
    imageUrl: null,
    imageAlt: t.title,
    bookingUrl: t.bookingUrl,
    location: null,
    tags: t.tags || [],
    scrapedAt,
    isRecommended: false,
    isMock: true,
  }));
}

module.exports = { generate };
