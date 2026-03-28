import { describe, it, expect } from 'vitest';
import {
  signInSchema,
  registerSchema,
  forgotPasswordSchema,
  createListingSchema,
  updateListingSchema,
  listingFilterSchema,
  createSellingAgentSchema,
  createBuyingAgentSchema,
  updateAgentStatusSchema,
  sendMessageSchema,
  searchSchema,
  conciergeMessageSchema,
  sendOfferSchema,
} from '@/lib/validators';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
const validCuid = 'clxxxxxxxxxxxxxxxxxxxxxxxxx'; // rough cuid shape

function expectPass(schema: { safeParse: (d: unknown) => { success: boolean } }, data: unknown) {
  expect(schema.safeParse(data).success).toBe(true);
}

function expectFail(schema: { safeParse: (d: unknown) => { success: boolean } }, data: unknown) {
  expect(schema.safeParse(data).success).toBe(false);
}

// ──────────────────────────────────────────────
// signInSchema
// ──────────────────────────────────────────────
describe('signInSchema', () => {
  const valid = { email: 'a@b.com', password: '12345678' };

  it('accepts valid input', () => expectPass(signInSchema, valid));
  it('rejects missing email', () => expectFail(signInSchema, { password: '12345678' }));
  it('rejects missing password', () => expectFail(signInSchema, { email: 'a@b.com' }));
  it('rejects invalid email', () => expectFail(signInSchema, { ...valid, email: 'not-email' }));
  it('rejects short password', () => expectFail(signInSchema, { ...valid, password: '123' }));
  it('accepts exactly 8-char password', () =>
    expectPass(signInSchema, { ...valid, password: 'abcdefgh' }));
});

// ──────────────────────────────────────────────
// registerSchema
// ──────────────────────────────────────────────
describe('registerSchema', () => {
  const valid = {
    name: 'John',
    email: 'john@example.com',
    password: 'Secure123',
    confirmPassword: 'Secure123',
    gdprConsent: true,
  };

  it('accepts valid input', () => expectPass(registerSchema, valid));
  it('applies defaults (locale, marketingOptIn)', () => {
    const result = registerSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.locale).toBe('en');
      expect(result.data.marketingOptIn).toBe(false);
    }
  });

  it('rejects missing name', () => expectFail(registerSchema, { ...valid, name: undefined }));
  it('rejects short name', () => expectFail(registerSchema, { ...valid, name: 'A' }));
  it('rejects invalid email format', () => expectFail(registerSchema, { ...valid, email: 'bad' }));
  it('rejects short password', () =>
    expectFail(registerSchema, {
      ...valid,
      password: 'abc',
      confirmPassword: 'abc',
    }));
  it('rejects password mismatch', () =>
    expectFail(registerSchema, { ...valid, confirmPassword: 'Different1' }));
  it('rejects gdprConsent = false', () =>
    expectFail(registerSchema, { ...valid, gdprConsent: false }));
  it('accepts valid locale enum', () => expectPass(registerSchema, { ...valid, locale: 'lv' }));
  it('rejects invalid locale enum', () => expectFail(registerSchema, { ...valid, locale: 'fr' }));
});

// ──────────────────────────────────────────────
// forgotPasswordSchema
// ──────────────────────────────────────────────
describe('forgotPasswordSchema', () => {
  it('accepts valid email', () => expectPass(forgotPasswordSchema, { email: 'a@b.com' }));
  it('rejects invalid email', () => expectFail(forgotPasswordSchema, { email: 'nope' }));
  it('rejects missing email', () => expectFail(forgotPasswordSchema, {}));
});

// ──────────────────────────────────────────────
// createListingSchema
// ──────────────────────────────────────────────
describe('createListingSchema', () => {
  const valid = {
    title: 'Great item for sale',
    description: 'A really nice item that is in great condition and worth buying.',
    price: 99.99,
    categoryId: validCuid,
  };

  it('accepts valid input with defaults', () => {
    const result = createListingSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe('EUR');
      expect(result.data.negotiable).toBe(true);
      expect(result.data.condition).toBe('USED');
    }
  });

  it('rejects title shorter than 5 chars', () =>
    expectFail(createListingSchema, { ...valid, title: 'Hi' }));
  it('rejects title longer than 200 chars', () =>
    expectFail(createListingSchema, { ...valid, title: 'x'.repeat(201) }));
  it('rejects description shorter than 20 chars', () =>
    expectFail(createListingSchema, { ...valid, description: 'Too short' }));
  it('rejects description longer than 5000 chars', () =>
    expectFail(createListingSchema, {
      ...valid,
      description: 'x'.repeat(5001),
    }));
  it('rejects zero price', () => expectFail(createListingSchema, { ...valid, price: 0 }));
  it('rejects negative price', () => expectFail(createListingSchema, { ...valid, price: -10 }));
  it('accepts large price', () => expectPass(createListingSchema, { ...valid, price: 1_000_000 }));
  it('rejects missing categoryId', () =>
    expectFail(createListingSchema, { ...valid, categoryId: undefined }));
  it('rejects non-cuid categoryId', () =>
    expectFail(createListingSchema, { ...valid, categoryId: 'abc' }));
  it('accepts all condition enums', () => {
    for (const condition of ['NEW', 'USED', 'REFURBISHED']) {
      expectPass(createListingSchema, { ...valid, condition });
    }
  });
  it('rejects invalid condition enum', () =>
    expectFail(createListingSchema, { ...valid, condition: 'BROKEN' }));
  it('accepts optional fields', () =>
    expectPass(createListingSchema, {
      ...valid,
      locationId: validCuid,
      contactPhone: '+123',
      contactEmail: 'x@y.com',
      latitude: 56.95,
      longitude: 24.11,
    }));
  it('rejects latitude out of range', () => {
    expectFail(createListingSchema, { ...valid, latitude: 91 });
    expectFail(createListingSchema, { ...valid, latitude: -91 });
  });
  it('rejects longitude out of range', () => {
    expectFail(createListingSchema, { ...valid, longitude: 181 });
    expectFail(createListingSchema, { ...valid, longitude: -181 });
  });
  it('rejects invalid contactEmail', () =>
    expectFail(createListingSchema, { ...valid, contactEmail: 'bad' }));
});

// ──────────────────────────────────────────────
// updateListingSchema (partial)
// ──────────────────────────────────────────────
describe('updateListingSchema', () => {
  it('accepts empty object (all partial)', () => expectPass(updateListingSchema, {}));
  it('accepts partial field', () => expectPass(updateListingSchema, { price: 50 }));
  it('still validates field constraints', () => expectFail(updateListingSchema, { price: -1 }));
});

// ──────────────────────────────────────────────
// listingFilterSchema
// ──────────────────────────────────────────────
describe('listingFilterSchema', () => {
  it('accepts empty object with defaults', () => {
    const result = listingFilterSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sortBy).toBe('newest');
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(24);
    }
  });
  it('accepts all sortBy values', () => {
    for (const sortBy of ['newest', 'oldest', 'price_asc', 'price_desc', 'views']) {
      expectPass(listingFilterSchema, { sortBy });
    }
  });
  it('rejects invalid sortBy', () => expectFail(listingFilterSchema, { sortBy: 'random' }));
  it('rejects page < 1', () => expectFail(listingFilterSchema, { page: 0 }));
  it('rejects limit > 100', () => expectFail(listingFilterSchema, { limit: 101 }));
  it('rejects negative minPrice', () => expectFail(listingFilterSchema, { minPrice: -1 }));
  it('accepts condition filter', () => expectPass(listingFilterSchema, { condition: 'NEW' }));
  it('accepts status filter', () => expectPass(listingFilterSchema, { status: 'SOLD' }));
});

// ──────────────────────────────────────────────
// createSellingAgentSchema
// ──────────────────────────────────────────────
describe('createSellingAgentSchema', () => {
  const valid = {
    urgency: 'ONE_WEEK' as const,
    startingPrice: 100,
    minimumPrice: 80,
  };

  it('accepts valid input', () => expectPass(createSellingAgentSchema, valid));
  it('applies boolean defaults', () => {
    const result = createSellingAgentSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.autoRespond).toBe(true);
      expect(result.data.autoNegotiate).toBe(false);
      expect(result.data.autoBoost).toBe(false);
    }
  });
  it('accepts all urgency enums', () => {
    for (const urgency of [
      'ONE_DAY',
      'THREE_DAYS',
      'ONE_WEEK',
      'TWO_WEEKS',
      'ONE_MONTH',
      'NO_RUSH',
    ]) {
      expectPass(createSellingAgentSchema, { ...valid, urgency });
    }
  });
  it('rejects invalid urgency', () =>
    expectFail(createSellingAgentSchema, { ...valid, urgency: 'ASAP' }));
  it('rejects non-positive startingPrice', () =>
    expectFail(createSellingAgentSchema, { ...valid, startingPrice: 0 }));
  it('rejects non-positive minimumPrice', () =>
    expectFail(createSellingAgentSchema, { ...valid, minimumPrice: -5 }));
  it('accepts optional listingId cuid', () =>
    expectPass(createSellingAgentSchema, { ...valid, listingId: validCuid }));
  it('rejects invalid listingId cuid', () =>
    expectFail(createSellingAgentSchema, { ...valid, listingId: '123' }));
  it('accepts maxDiscountPercent in range', () =>
    expectPass(createSellingAgentSchema, { ...valid, maxDiscountPercent: 50 }));
  it('rejects maxDiscountPercent > 100', () =>
    expectFail(createSellingAgentSchema, {
      ...valid,
      maxDiscountPercent: 101,
    }));
  it('rejects maxDiscountPercent < 0', () =>
    expectFail(createSellingAgentSchema, { ...valid, maxDiscountPercent: -1 }));
});

// ──────────────────────────────────────────────
// createBuyingAgentSchema
// ──────────────────────────────────────────────
describe('createBuyingAgentSchema', () => {
  const valid = {
    searchCriteria: { keywords: 'bike' },
    maxBudget: 500,
  };

  it('accepts valid input', () => expectPass(createBuyingAgentSchema, valid));
  it('applies boolean defaults', () => {
    const result = createBuyingAgentSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.autoNegotiate).toBe(false);
      expect(result.data.notifyPush).toBe(true);
      expect(result.data.notifyEmail).toBe(true);
    }
  });
  it('rejects non-positive maxBudget', () =>
    expectFail(createBuyingAgentSchema, { ...valid, maxBudget: 0 }));
  it('accepts condition in searchCriteria', () =>
    expectPass(createBuyingAgentSchema, {
      ...valid,
      searchCriteria: { condition: 'NEW' },
    }));
  it('rejects invalid condition in searchCriteria', () =>
    expectFail(createBuyingAgentSchema, {
      ...valid,
      searchCriteria: { condition: 'JUNK' },
    }));
});

// ──────────────────────────────────────────────
// updateAgentStatusSchema
// ──────────────────────────────────────────────
describe('updateAgentStatusSchema', () => {
  it('accepts valid input', () =>
    expectPass(updateAgentStatusSchema, {
      agentId: validCuid,
      status: 'PAUSED',
    }));
  it('accepts all status enums', () => {
    for (const status of ['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED']) {
      expectPass(updateAgentStatusSchema, { agentId: validCuid, status });
    }
  });
  it('rejects invalid status', () =>
    expectFail(updateAgentStatusSchema, {
      agentId: validCuid,
      status: 'STOPPED',
    }));
  it('rejects missing agentId', () => expectFail(updateAgentStatusSchema, { status: 'ACTIVE' }));
});

// ──────────────────────────────────────────────
// sendMessageSchema
// ──────────────────────────────────────────────
describe('sendMessageSchema', () => {
  const valid = {
    receiverId: validCuid,
    listingId: validCuid,
    content: 'Hello!',
  };

  it('accepts valid input', () => expectPass(sendMessageSchema, valid));
  it('accepts optional conversationId', () =>
    expectPass(sendMessageSchema, { ...valid, conversationId: validCuid }));
  it('rejects empty content', () => expectFail(sendMessageSchema, { ...valid, content: '' }));
  it('rejects content over 2000 chars', () =>
    expectFail(sendMessageSchema, { ...valid, content: 'x'.repeat(2001) }));
  it('rejects missing receiverId', () =>
    expectFail(sendMessageSchema, { listingId: validCuid, content: 'Hi' }));
  it('rejects missing listingId', () =>
    expectFail(sendMessageSchema, { receiverId: validCuid, content: 'Hi' }));
});

// ──────────────────────────────────────────────
// searchSchema
// ──────────────────────────────────────────────
describe('searchSchema', () => {
  it('accepts valid query', () => expectPass(searchSchema, { query: 'bike' }));
  it('applies defaults', () => {
    const result = searchSchema.safeParse({ query: 'bike' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(24);
    }
  });
  it('rejects empty query', () => expectFail(searchSchema, { query: '' }));
  it('rejects query over 200 chars', () => expectFail(searchSchema, { query: 'x'.repeat(201) }));
  it('rejects negative minPrice', () => expectFail(searchSchema, { query: 'a', minPrice: -1 }));
});

// ──────────────────────────────────────────────
// conciergeMessageSchema
// ──────────────────────────────────────────────
describe('conciergeMessageSchema', () => {
  it('accepts valid message', () =>
    expectPass(conciergeMessageSchema, { message: 'Help me find a car' }));
  it('rejects empty message', () => expectFail(conciergeMessageSchema, { message: '' }));
  it('rejects message over 1000 chars', () =>
    expectFail(conciergeMessageSchema, { message: 'x'.repeat(1001) }));
  it('accepts conversationHistory', () =>
    expectPass(conciergeMessageSchema, {
      message: 'Hi',
      conversationHistory: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'How can I help?' },
      ],
    }));
  it('rejects invalid role in conversationHistory', () =>
    expectFail(conciergeMessageSchema, {
      message: 'Hi',
      conversationHistory: [{ role: 'system', content: 'x' }],
    }));
});

// ──────────────────────────────────────────────
// sendOfferSchema
// ──────────────────────────────────────────────
describe('sendOfferSchema', () => {
  const valid = {
    conversationId: validCuid,
    receiverId: validCuid,
    listingId: validCuid,
    offerPrice: 50,
  };

  it('accepts valid input', () => expectPass(sendOfferSchema, valid));
  it('rejects zero offerPrice', () => expectFail(sendOfferSchema, { ...valid, offerPrice: 0 }));
  it('rejects negative offerPrice', () =>
    expectFail(sendOfferSchema, { ...valid, offerPrice: -10 }));
  it('accepts optional message', () =>
    expectPass(sendOfferSchema, { ...valid, message: 'Please consider' }));
  it('rejects message over 500 chars', () =>
    expectFail(sendOfferSchema, { ...valid, message: 'x'.repeat(501) }));
  it('rejects missing conversationId', () =>
    expectFail(sendOfferSchema, {
      receiverId: validCuid,
      listingId: validCuid,
      offerPrice: 50,
    }));
});
