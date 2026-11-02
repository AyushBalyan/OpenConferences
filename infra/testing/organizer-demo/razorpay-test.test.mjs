import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createTestGateway } from './razorpay-test.mjs';

const secret = 'dummy-unit-test-secret';
const payment = { providerOrderId: 'order_fixture', amountMinor: 425000, currency: 'INR' };
const callback = {
  razorpay_order_id: payment.providerOrderId,
  razorpay_payment_id: 'pay_fixture',
  razorpay_signature: createHmac('sha256', secret).update('order_fixture|pay_fixture').digest('hex'),
};
const remote = { id: 'pay_fixture', order_id: 'order_fixture', amount: 425000, currency: 'INR', status: 'captured', captured: true };

test('live credentials cannot be used with unauthenticated dummy users', () => {
  assert.throws(() => createTestGateway('rzp_live_fixture', secret), /Live keys are forbidden/);
});
test('a valid captured payment is verified against the provider', async () => {
  const gateway = createTestGateway('rzp_test_fixture', secret, async () => ({ ok: true, json: async () => remote }));
  assert.deepEqual(await gateway.verify(payment, callback), { paymentId: 'pay_fixture', captured: true });
});
test('a bad signature is rejected before fetching a payment', async () => {
  const gateway = createTestGateway('rzp_test_fixture', secret, () => assert.fail('Must not fetch'));
  await assert.rejects(gateway.verify(payment, { ...callback, razorpay_signature: '0'.repeat(64) }), /signature/);
});
test('a different amount or currency cannot mark a registration paid', async () => {
  for (const changed of [{ amount: 100 }, { currency: 'USD' }, { order_id: 'order_other' }]) {
    const gateway = createTestGateway('rzp_test_fixture', secret, async () => ({ ok: true, json: async () => ({ ...remote, ...changed }) }));
    await assert.rejects(gateway.verify(payment, callback), /does not match/);
  }
});
test('authorization alone is not treated as captured', async () => {
  const gateway = createTestGateway('rzp_test_fixture', secret, async () => ({ ok: true, json: async () => ({ ...remote, status: 'authorized', captured: false }) }));
  assert.equal((await gateway.verify(payment, callback)).captured, false);
});
