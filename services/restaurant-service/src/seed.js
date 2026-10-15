import { config } from './config/env.js';
import { MenuItem } from './models/MenuItem.js';
import { Restaurant } from './models/Restaurant.js';

const SAMPLE_DATA = [
  {
    restaurant: {
      name: 'Burger Hub',
      description: 'Smash burgers and fries',
      cuisine: 'Fast Food',
      address: { street: '12 Galle Road', city: 'Colombo' },
      phone: '0112345678',
      rating: 4.4,
      deliveryFee: 250
    },
    menu: [
      { name: 'Classic Burger', price: 1450, category: 'Burgers' },
      { name: 'Cheese Burger', price: 1650, category: 'Burgers' },
      { name: 'French Fries', price: 600, category: 'Sides' },
      { name: 'Iced Coffee', price: 550, category: 'Drinks' }
    ]
  },
  {
    restaurant: {
      name: 'Spice Garden',
      description: 'Sri Lankan rice and curry',
      cuisine: 'Sri Lankan',
      address: { street: '45 Kandy Road', city: 'Kandy' },
      phone: '0812345678',
      rating: 4.7,
      deliveryFee: 300
    },
    menu: [
      { name: 'Chicken Rice & Curry', price: 1200, category: 'Rice' },
      { name: 'Vegetable Kottu', price: 950, category: 'Kottu' },
      { name: 'Watalappan', price: 450, category: 'Desserts' }
    ]
  }
];

export async function seedSampleData() {
  if (!config.seedData || (await Restaurant.estimatedDocumentCount()) > 0) return;

  for (const { restaurant, menu } of SAMPLE_DATA) {
    const created = await Restaurant.create(restaurant);
    await MenuItem.insertMany(menu.map((item) => ({ ...item, restaurantId: created.id })));
  }
  console.log(`Seeded ${SAMPLE_DATA.length} sample restaurants`);
}
