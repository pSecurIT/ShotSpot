import { waitFor } from '@testing-library/react';

/**
 * Helper function to wait for a select element to have options loaded
 * This prevents "Value not found in options" errors when testing components
 * that load options asynchronously from an API
 * 
 * @param selectElement - The select element or a function to get it
 * @param minOptions - Minimum number of options expected (default 1, excluding placeholder)
 * @param timeout - Maximum time to wait in milliseconds (default 3000)
 * 
 * @example
 * // Using with getByRole
 * const select = screen.getByRole('combobox', { name: /player/i });
 * await waitForSelectOptions(select);
 * await user.selectOptions(select, '1');
 * 
 * @example
 * // Using with a selector function (recommended if element might not exist initially)
 * await waitForSelectOptions(() => screen.getByDisplayValue('Select player'));
 * const select = screen.getByDisplayValue('Select player');
 * await user.selectOptions(select, '1');
 */
export async function waitForSelectOptions(
  selectElement: HTMLSelectElement | (() => HTMLSelectElement),
  minOptions: number = 1,
  timeout: number = 3000
): Promise<void> {
  await waitFor(
    () => {
      const element = typeof selectElement === 'function' ? selectElement() : selectElement;
      const optionCount = element.querySelectorAll('option').length;
      // Account for placeholder option - we need at least minOptions + 1
      if (optionCount <= minOptions) {
        throw new Error(
          `Expected at least ${minOptions + 1} option(s) (including placeholder), but found ${optionCount}`
        );
      }
    },
    { timeout }
  );
}

/**
 * Helper function to wait for a select element and then select an option
 * Combines waiting for options to load and selecting a value
 * 
 * @param user - The userEvent instance from @testing-library/user-event
 * @param selectElement - The select element or a function to get it
 * @param value - The value to select
 * @param minOptions - Minimum number of options expected (default 1, excluding placeholder)
 * 
 * @example
 * const user = userEvent.setup();
 * await waitForAndSelectOption(
 *   user,
 *   () => screen.getByRole('combobox', { name: /player/i }),
 *   '1'
 * );
 */
export async function waitForAndSelectOption(
  user: ReturnType<typeof import('@testing-library/user-event').default.setup>,
  selectElement: HTMLSelectElement | (() => HTMLSelectElement),
  value: string,
  minOptions: number = 1
): Promise<void> {
  await waitForSelectOptions(selectElement, minOptions);
  const element = typeof selectElement === 'function' ? selectElement() : selectElement;
  await user.selectOptions(element, value);
}
