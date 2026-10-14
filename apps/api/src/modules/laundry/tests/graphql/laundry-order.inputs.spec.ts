import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { WeighLaundryOrderInput } from '../../presentation/graphql/laundry-order.inputs';

// The weigh input's minimum (Amendment #164 §8.4.1). The global
// ValidationPipe runs these same decorators on every GraphQL call.
describe('WeighLaundryOrderInput', () => {
  async function constraintsFor(weightGrams: unknown): Promise<string[]> {
    const errors = await validate(
      plainToInstance(WeighLaundryOrderInput, { orderId: 'o1', weightGrams }),
    );
    return errors.flatMap((error) => Object.keys(error.constraints ?? {}));
  }

  it('accepts one gram', async () => {
    expect(await constraintsFor(1)).toEqual([]);
  });

  it('rejects zero with the min constraint', async () => {
    expect(await constraintsFor(0)).toEqual(['min']);
  });

  it('rejects a negative weight with the min constraint', async () => {
    expect(await constraintsFor(-1)).toEqual(['min']);
  });

  it('rejects a fractional weight with the int constraint', async () => {
    expect(await constraintsFor(1.5)).toEqual(['isInt']);
  });
});
