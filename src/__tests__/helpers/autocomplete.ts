import { screen, fireEvent } from "@testing-library/react";

/**
 * Open a HeroUI Autocomplete combobox and select an option by its visible text.
 * Usage:
 *   const boxes = screen.getAllByRole('combobox', { name: /Winner/i });
 *   await pickOptionForCombobox(boxes[0], 'Alpha');
 */
export async function pickOptionForCombobox(
  combobox: HTMLElement,
  optionText: string
) {
  // Type to filter options
  fireEvent.change(combobox, { target: { value: optionText } });
  // Ensure the menu is open in test env
  fireEvent.keyDown(combobox, { key: "ArrowDown" });
  // Select the option from the portal menu
  const option = await screen.findByRole("option", {
    name: new RegExp(optionText, "i"),
  });
  fireEvent.click(option);
}

/**
 * Find a combobox by label or placeholder text and pick an option.
 * Helpful when there is a single Autocomplete on screen.
 */
export async function pickAutocompleteOption(
  labelOrPlaceholder: string | RegExp,
  optionText: string
) {
  const combobox = screen.getByRole("combobox", { name: labelOrPlaceholder });
  await pickOptionForCombobox(combobox, optionText);
}
