import { screen, fireEvent, within } from "@testing-library/react";

/**
 * Find the Autocomplete indicator button (aria-haspopup="listbox") by its label text.
 *
 * In HeroUI v3 the Autocomplete container (`data-slot="autocomplete"`) wraps
 * both the label span and the trigger group. We locate the label first, walk
 * up to the autocomplete container, then query for the indicator button inside
 * it. This avoids false-positive matches against sibling "Remove teammate X"
 * buttons that share the same label text.
 */
export function findAutocompleteButton(
  labelText: string | RegExp,
  container: HTMLElement = document.body,
): HTMLElement {
  const allText = within(container).getAllByText(labelText);
  for (const textEl of allText) {
    const autocompleteDiv = textEl.closest('[data-slot="autocomplete"]');
    if (autocompleteDiv) {
      const triggerBtn = autocompleteDiv.querySelector(
        'button[aria-haspopup="listbox"]',
      ) as HTMLElement | null;
      if (triggerBtn) return triggerBtn;
    }
  }
  throw new Error(
    `No Autocomplete trigger button found with label: ${String(labelText)}`,
  );
}

/**
 * Open a HeroUI v3 Autocomplete trigger button and select an option by its visible text.
 *
 * Usage:
 *   const trigger = findAutocompleteButton(/Teammate 2/i);
 *   await pickOptionForCombobox(trigger, 'Beta');
 *
 * — or via the combined helper —
 *
 *   await pickAutocompleteOption(/Teammate 2/i, 'Beta');
 */
export async function pickOptionForCombobox(
  triggerBtn: HTMLElement,
  optionText: string,
) {
  // Click the trigger to open the popover
  fireEvent.click(triggerBtn);
  // Find the search input inside the opened popover
  const searchInput = await screen.findByPlaceholderText("Search...");
  // Type to filter options
  fireEvent.change(searchInput, { target: { value: optionText } });
  // Select the option from the portal menu
  const option = await screen.findByRole("option", {
    name: new RegExp(optionText, "i"),
  });
  fireEvent.click(option);
}

/**
 * Find an Autocomplete by its label text and pick an option.
 * Helpful when there is a single Autocomplete on screen.
 */
export async function pickAutocompleteOption(
  labelText: string | RegExp,
  optionText: string,
) {
  const trigger = findAutocompleteButton(labelText);
  await pickOptionForCombobox(trigger, optionText);
}
