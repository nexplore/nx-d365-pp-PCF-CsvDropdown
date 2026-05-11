import { IInputs, IOutputs } from "./generated/ManifestTypes";

const CUSTOM_SENTINEL = "__custom__";

// Fluent UI Checkmark12Regular SVG
const CHECKMARK_SVG = '<svg fill="currentColor" aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg"><path d="M9.76 3.2a.75.75 0 0 1 .04 1.06l-5.16 5.54a.75.75 0 0 1-1.1-.04l-2.17-2.6a.75.75 0 1 1 1.15-.96l1.64 1.97 4.6-4.93a.75.75 0 0 1 1-.04Z" fill="currentColor"></path></svg>';

// Fluent UI ChevronDown (Dropdown__expandIcon) SVG
const CHEVRON_SVG = '<svg fill="currentColor" aria-hidden="true" width="1em" height="1em" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M15.85 7.65c.2.2.2.5 0 .7l-5.46 5.49a.55.55 0 0 1-.78 0L4.15 8.35a.5.5 0 1 1 .7-.7L10 12.8l5.15-5.16c.2-.2.5-.2.7 0Z" fill="currentColor"></path></svg>';

export class CsvDropdownControl implements ComponentFramework.StandardControl<IInputs, IOutputs> {

	private _container: HTMLDivElement;
	private _context: ComponentFramework.Context<IInputs>;
	private _notifyOutputChanged: () => void;

	private _value: string;
	private _isRequiedField: boolean;
	private _isLockedField: boolean;
	private _csvValuesList: string[] = [];
	private _userDirty = false; // true after user selects, cleared after getOutputs

	// Custom dropdown elements
	private _wrapper: HTMLDivElement;
	private _button: HTMLButtonElement;
	private _buttonText: HTMLSpanElement;
	private _listbox: HTMLUListElement;
	private _isOpen = false;

	// Custom value input
	private _customWrapper: HTMLDivElement;
	private _customInput: HTMLInputElement;
	private _customBackBtn: HTMLButtonElement;

	// Track highlighted index for keyboard navigation
	private _highlightedIndex = -1;

	// Bound handlers for cleanup
	private _onDocumentClick: (e: MouseEvent) => void;
	private _onKeyDown: (e: KeyboardEvent) => void;

	public init(context: ComponentFramework.Context<IInputs>, notifyOutputChanged: () => void, state: ComponentFramework.Dictionary, container: HTMLDivElement) {
		this._container = container;
		this._context = context;
		this._notifyOutputChanged = notifyOutputChanged;

		// Type assertion with proper interface for accessing metadata
		interface FieldParameter {
			attributes: {
				RequiredLevel: number;
			};
		}
		this._isRequiedField = (context.parameters.fieldValue as unknown as FieldParameter).attributes.RequiredLevel == 2;
		this._isLockedField = context.mode.isControlDisabled;

		// Dropdown wrapper
		const wrapper = document.createElement("div");
		wrapper.className = "dropdown-wrapper";

		// Button (trigger)
		const button = document.createElement("button");
		button.type = "button";
		button.className = "dropdown-button";
		button.setAttribute("role", "combobox");
		button.setAttribute("aria-expanded", "false");
		button.setAttribute("aria-haspopup", "listbox");

		const buttonText = document.createElement("span");
		buttonText.className = "dropdown-button-text";
		buttonText.textContent = "---";
		button.appendChild(buttonText);

		const expandIcon = document.createElement("span");
		expandIcon.className = "dropdown-expand-icon";
		expandIcon.setAttribute("aria-hidden", "true");
		expandIcon.innerHTML = CHEVRON_SVG;
		button.appendChild(expandIcon);

		button.addEventListener("click", () => this.toggleListbox());
		button.addEventListener("keydown", (e) => this.onButtonKeyDown(e));
		this._button = button;
		this._buttonText = buttonText;
		wrapper.appendChild(button);

		// Listbox – appended to document.body to escape overflow:hidden in MDA form cells
		const listbox = document.createElement("ul");
		listbox.setAttribute("role", "listbox");
		// All styles inline because PCF scopes CSS to the control container
		Object.assign(listbox.style, {
			display: "none",
			position: "fixed",
			zIndex: "1000000",
			maxHeight: "300px",
			overflowY: "auto",
			margin: "0",
			padding: "4px 0",
			listStyle: "none",
			background: "#ffffff",
			border: "1px solid #e0e0e0",
			borderRadius: "4px",
			boxShadow: "0 2px 8px rgba(0,0,0,0.14)",
			boxSizing: "border-box"
		});
		this._listbox = listbox;
		document.body.appendChild(listbox);

		this._wrapper = wrapper;
		container.appendChild(wrapper);

		// Custom value wrapper (hidden by default)
		const customWrapper = document.createElement("div");
		customWrapper.className = "custom-input-wrapper";
		customWrapper.style.display = "none";

		const customInput = document.createElement("input");
		customInput.type = "text";
		customInput.className = "custom-input";
		customInput.placeholder = "Wert eingeben\u2026";
		customInput.addEventListener("change", () => this.onCustomInputChanged());
		customInput.addEventListener("keydown", (e) => {
			if (e.key === "Escape") {
				this.switchToDropdown();
			}
		});

		const backBtn = document.createElement("button");
		backBtn.type = "button";
		backBtn.className = "custom-back-btn";
		backBtn.title = "Zur\u00FCck zur Auswahl";
		backBtn.textContent = "\u2715";
		backBtn.addEventListener("click", () => this.switchToDropdown());

		customWrapper.appendChild(customInput);
		customWrapper.appendChild(backBtn);
		container.appendChild(customWrapper);

		this._customWrapper = customWrapper;
		this._customInput = customInput;
		this._customBackBtn = backBtn;

		// Close on outside click
		this._onDocumentClick = (e: MouseEvent) => {
			if (this._isOpen
				&& !this._wrapper.contains(e.target as Node)
				&& !this._listbox.contains(e.target as Node)) {
				this.closeListbox();
			}
		};
		document.addEventListener("click", this._onDocumentClick);

		// Keyboard navigation
		this._onKeyDown = (e: KeyboardEvent) => {
			if (!this._isOpen) return;
			const items = Array.from(this._listbox.children) as HTMLLIElement[];
			switch (e.key) {
				case "Escape":
					this.closeListbox();
					this._button.focus();
					e.preventDefault();
					break;
				case "ArrowDown":
					this._highlightedIndex = Math.min(this._highlightedIndex + 1, items.length - 1);
					this.updateHighlight(items);
					e.preventDefault();
					break;
				case "ArrowUp":
					this._highlightedIndex = Math.max(this._highlightedIndex - 1, 0);
					this.updateHighlight(items);
					e.preventDefault();
					break;
				case "Enter":
					if (this._highlightedIndex >= 0 && this._highlightedIndex < items.length) {
						const val = items[this._highlightedIndex].dataset.value ?? "";
						this.selectOption(val);
					}
					e.preventDefault();
					break;
				case "Tab":
					this.closeListbox();
					break;
				default:
					break;
			}
		};
		document.addEventListener("keydown", this._onKeyDown);
	}

	public updateView(context: ComponentFramework.Context<IInputs>): void {
		try {
			this._isLockedField = context.mode.isControlDisabled;
			this._button.disabled = this._isLockedField;
			this._customInput.disabled = this._isLockedField;
			this._customBackBtn.disabled = this._isLockedField;

			const csvValues = context.parameters.csvValues.raw;
			if (!csvValues) {
				return;
			}
			this._csvValuesList = csvValues.split(";");

			// Determine the value to display
			const contextValue = context.parameters.fieldValue.raw;
			const contextStr = contextValue != null ? String(contextValue) : "";

			// Don't overwrite user selection until the context round-trips
			if (!this._userDirty) {
				this._value = contextStr;
			}

			const allowCustom = context.parameters.allowCustomValue?.raw === true;

			if (allowCustom && this._value && !this._csvValuesList.includes(this._value) && this._value !== "") {
				this.showCustomInput(this._value);
			} else {
				this.showDropdown();
			}

			this.rebuildOptions(allowCustom, context);
			this.updateButtonText();
		} catch (e) {
			console.log(e);
		}
	}

	private rebuildOptions(allowCustom: boolean, context: ComponentFramework.Context<IInputs>): void {
		while (this._listbox.firstChild) {
			this._listbox.removeChild(this._listbox.lastChild!);
		}

		if (!this._isRequiedField) {
			this.createOptionItem("", "---");
		}

		for (const value of this._csvValuesList) {
			this.createOptionItem(value, value);
		}

		if (allowCustom) {
			const customLabel = context.parameters.customValueLabel?.raw || "Benutzerdefiniert\u2026";
			this.createOptionItem(CUSTOM_SENTINEL, customLabel);
		}
	}

	private createOptionItem(value: string, label: string): void {
		const li = document.createElement("li");
		li.setAttribute("role", "option");
		li.dataset.value = value;

		const isSelected = this._value === value;
		if (isSelected) {
			li.setAttribute("aria-selected", "true");
		}

		// Inline styles for option row
		Object.assign(li.style, {
			display: "flex",
			alignItems: "center",
			gap: "4px",
			padding: "5px 8px 5px 4px",
			cursor: "pointer",
			fontFamily: '"Segoe UI", "Segoe UI Web (West European)", -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", sans-serif',
			fontSize: "14px",
			fontWeight: "400",
			color: "#242424",
			whiteSpace: "nowrap",
			textAlign: "left"
		});

		// Hover effect
		li.addEventListener("mouseenter", () => { li.style.backgroundColor = "#f5f5f5"; });
		li.addEventListener("mouseleave", () => { li.style.backgroundColor = "transparent"; });

		// Checkmark slot
		const checkSpan = document.createElement("span");
		Object.assign(checkSpan.style, {
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			width: "16px",
			height: "16px",
			flexShrink: "0",
			color: "#242424"
		});
		if (isSelected && value !== "") {
			checkSpan.innerHTML = CHECKMARK_SVG;
		}
		li.appendChild(checkSpan);

		// Text
		const textSpan = document.createElement("span");
		Object.assign(textSpan.style, {
			flex: "1",
			overflow: "hidden",
			textOverflow: "ellipsis"
		});
		textSpan.textContent = label;
		li.appendChild(textSpan);

		li.addEventListener("click", () => this.selectOption(value));
		this._listbox.appendChild(li);
	}

	private selectOption(value: string): void {
		this.closeListbox();

		if (value === CUSTOM_SENTINEL) {
			this.showCustomInput("");
			this._customInput.focus();
			return;
		}

		this._value = value;
		this._userDirty = true;
		this.updateSelectedState();
		this.updateButtonText();
		this._notifyOutputChanged();
	}

	private updateSelectedState(): void {
		for (const li of Array.from(this._listbox.children) as HTMLLIElement[]) {
			const val = li.dataset.value;
			const isSelected = val === this._value;
			li.setAttribute("aria-selected", String(isSelected));

			const checkSpan = li.children[0] as HTMLSpanElement;
			if (checkSpan) {
				// Don't show checkmark on the clear/empty option
				checkSpan.innerHTML = (isSelected && val !== "") ? CHECKMARK_SVG : "";
			}
		}
	}

	private updateButtonText(): void {
		if (this._value === "" && !this._isRequiedField) {
			this._buttonText.textContent = "---";
		} else {
			this._buttonText.textContent = this._value || "---";
		}
	}

	private toggleListbox(): void {
		if (this._isOpen) {
			this.closeListbox();
		} else {
			this.openListbox();
		}
	}

	private openListbox(): void {
		const rect = this._button.getBoundingClientRect();
		this._listbox.style.top = `${rect.bottom}px`;
		this._listbox.style.left = `${rect.left}px`;
		this._listbox.style.width = `${rect.width}px`;
		this._listbox.style.display = "block";
		this._isOpen = true;
		this._button.setAttribute("aria-expanded", "true");

		// Set initial highlight to the currently selected item
		const items = Array.from(this._listbox.children) as HTMLLIElement[];
		this._highlightedIndex = items.findIndex(li => li.dataset.value === this._value);
		if (this._highlightedIndex < 0) this._highlightedIndex = 0;
		this.updateHighlight(items);
	}

	private closeListbox(): void {
		this._listbox.style.display = "none";
		this._isOpen = false;
		this._highlightedIndex = -1;
		this._button.setAttribute("aria-expanded", "false");
	}

	private onButtonKeyDown(e: KeyboardEvent): void {
		if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
			if (!this._isOpen) {
				this.openListbox();
				e.preventDefault();
			}
		} else if (e.key === "ArrowUp") {
			if (!this._isOpen) {
				this.openListbox();
				e.preventDefault();
			}
		}
	}

	private updateHighlight(items: HTMLLIElement[]): void {
		for (let i = 0; i < items.length; i++) {
			items[i].style.backgroundColor = i === this._highlightedIndex ? "#f5f5f5" : "transparent";
		}
		// Scroll highlighted item into view
		if (this._highlightedIndex >= 0 && this._highlightedIndex < items.length) {
			items[this._highlightedIndex].scrollIntoView({ block: "nearest" });
		}
	}

	public getOutputs(): IOutputs {
		this._userDirty = false;
		return {
			fieldValue: this._value === "" ? undefined : this._value
		};
	}

	public destroy(): void {
		document.removeEventListener("click", this._onDocumentClick);
		document.removeEventListener("keydown", this._onKeyDown);
		this._listbox.remove();
	}

	private onCustomInputChanged(): void {
		const val = this._customInput.value.trim();
		if (val) {
			this._value = val;
			this._userDirty = true;
			this._notifyOutputChanged();
		}
	}

	private showCustomInput(prefill: string): void {
		this._wrapper.style.display = "none";
		this._customWrapper.style.display = "flex";
		this._customInput.value = prefill;
	}

	private showDropdown(): void {
		this._wrapper.style.display = "";
		this._customWrapper.style.display = "none";
	}

	private switchToDropdown(): void {
		this.showDropdown();
		if (!this._isRequiedField) {
			this._value = "";
		} else {
			this._value = this._csvValuesList[0] ?? "";
		}
		this._userDirty = true;
		this.updateSelectedState();
		this.updateButtonText();
		this._notifyOutputChanged();
	}
}
export default CsvDropdownControl;