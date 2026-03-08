// ===================================
// Product Custom Options System
// Ymq Product Options & Variants Integration
// ===================================

const ProductOptions = {
    currentOptions: {},
    ymqCache: {}, // Cache for Ymq options from Shopify

    parsePrice(value) {
        if (typeof value === 'number') {
            return Number.isFinite(value) ? value : 0;
        }

        if (value === null || value === undefined) {
            return 0;
        }

        let str = String(value).trim();
        if (!str) {
            return 0;
        }

        str = str.replace(/\s+/g, '').replace(/[^\d,.-]/g, '');
        if (!str) {
            return 0;
        }

        const hasComma = str.includes(',');
        const hasDot = str.includes('.');

        if (hasComma && hasDot) {
            if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
                str = str.replace(/\./g, '').replace(/,/g, '.');
            } else {
                str = str.replace(/,/g, '');
            }
        } else if (hasComma) {
            str = str.replace(/,/g, '.');
        }

        const parsed = Number.parseFloat(str);
        return Number.isFinite(parsed) ? parsed : 0;
    },

    /**
     * Check if a product has loaded Ymq options
     */
    hasOptions(productHandle) {
        return this.ymqCache[productHandle] !== undefined;
    },

    /**
     * Get cached Ymq options for a product
     */
    getOptions(productHandle) {
        return this.ymqCache[productHandle] || null;
    },

    /**
     * Load Ymq options from Shopify for a specific product
     */
    async loadYmqOptions(productId, productHandle) {
        // Check cache first
        if (this.ymqCache[productHandle]) {
            return this.ymqCache[productHandle];
        }

        try {
            let ymqOptions = null;

            if (typeof BackendAPI !== 'undefined') {
                const response = await BackendAPI.getProductYmqOptions(productId);
                
                if (response.hasYmqOptions && response.options) {
                    ymqOptions = response.options;
                }
            }

            // Check for local config overrides / extra options
            const localConfig = this.getDefaultConfig();
            const localOptions = localConfig[productHandle];

            if (localOptions) {
                if (ymqOptions) {
                    // Merge: apply local overrides on top of Ymq options
                    const merged = [...ymqOptions];
                    localOptions.forEach(localOpt => {
                        const existingIdx = merged.findIndex(o => o.name === localOpt.name || o.label === localOpt.label);
                        if (existingIdx >= 0) {
                            // Override existing option with local config
                            merged[existingIdx] = { ...merged[existingIdx], ...localOpt };
                        } else {
                            // Add new option not in Ymq
                            merged.push(localOpt);
                        }
                    });
                    ymqOptions = merged;
                } else {
                    // No Ymq options, use local config
                    ymqOptions = localOptions;
                }
            }

            if (ymqOptions) {
                this.applyPriceCorrections(ymqOptions, productHandle);
                this.ymqCache[productHandle] = ymqOptions;
                return ymqOptions;
            }

            return null;
        } catch (error) {
            console.error('❌ Error loading Ymq options:', error);
            // Try local config as fallback on error
            const localConfig = this.getDefaultConfig();
            return localConfig[productHandle] || null;
        }
    },

    /**
    /**
     * Render custom options for a product
     */
    async renderOptions(productHandle, productId = null) {
        // Load options from Ymq
        const options = await this.loadYmqOptions(productId, productHandle);
        
        if (!options || options.length === 0) {
            return '';
        }

        let html = '<div class="custom-product-options">';
        html += '<h3 class="options-title">Personnalisez votre produit</h3>';

        options.forEach(option => {
            const colorKeywords = ['couleur', 'color', 'teinte', 'nuance'];
            const isColorOption = colorKeywords.some(kw =>
                option.name.toLowerCase().includes(kw) ||
                option.label.toLowerCase().includes(kw)
            );

            if (option.type === 'color') {
                html += this.renderColorOption(option, productHandle);
            } else if (option.type === 'select' && isColorOption) {
                const colorOption = {
                    ...option,
                    values: option.values.map(v => ({
                        ...v,
                        hex: typeof ShopifyIntegration !== 'undefined'
                            ? ShopifyIntegration.getColorHexFromName(v.name)
                            : '#CCCCCC'
                    }))
                };
                html += this.renderColorOption(colorOption, productHandle);
            } else if (option.type === 'select') {
                html += this.renderSelectOption(option, productHandle);
            } else if (option.type === 'checkbox') {
                html += this.renderCheckboxOption(option, productHandle);
            } else if (option.type === 'text') {
                html += this.renderTextOption(option, productHandle);
            } else if (option.type === 'image-select') {
                html += this.renderImageSelectOption(option, productHandle);
            } else if (option.type === 'variant-select') {
                html += this.renderVariantSelectOption(option, productHandle);
            }
        });

        html += '</div>';
        return html;
    },

    /**
     * Render a single option
     */
    renderOption(option, productHandle) {
        switch (option.type) {
            case 'color':
                return this.renderColorOption(option, productHandle);
            case 'select':
                return this.renderSelectOption(option, productHandle);
            case 'checkbox':
                return this.renderCheckboxOption(option, productHandle);
            case 'text':
                return this.renderTextOption(option, productHandle);
            case 'image-select':
                return this.renderImageSelectOption(option, productHandle);
            case 'variant-select':
                return this.renderVariantSelectOption(option, productHandle);
            default:
                return '';
        }
    },

    /**
     * Render Color Option
     */
    renderColorOption(option, productHandle) {
        return `
            <div class="custom-option color-option">
                <label class="option-label">
                    ${option.label}
                    ${option.required ? '<span class="required">*</span>' : ''}
                </label>
                <div class="color-options-grid">
                    ${option.values.map((color, index) => `
                        <button type="button" 
                                class="custom-color-button ${index === 0 ? 'selected' : ''}" 
                                data-option="${option.name}" 
                                data-value="${color.name}"
                                data-price="${color.price || 0}"
                                style="background-color: ${color.hex}"
                                title="${color.name}${color.price ? ' (+' + color.price + '€)' : ''}"
                                onclick="ProductOptions.selectColor(this, '${productHandle}')">
                            <span class="check-icon"><i class="fas fa-check"></i></span>
                        </button>
                    `).join('')}
                </div>
                <div class="selected-color-name">${option.values[0].name}</div>
            </div>
        `;
    },

    /**
     * Render Image Select Option (for Ymq type 8) - Multi-select
     */
    renderImageSelectOption(option, productHandle) {
        const isAccessoire = this.isAccessoireOption(option);
        return `
            <div class="custom-option image-select-option">
                <label class="option-label">
                    ${option.label}
                    ${option.required ? '<span class="required">*</span>' : ''}
                </label>
                <div class="image-options-grid">
                    ${option.values.map((item) => `
                        <button type="button" 
                                class="custom-image-button ${!item.image ? 'no-image' : ''}" 
                                data-option="${option.name}" 
                                data-value="${item.name}"
                                data-price="${item.price || 0}"
                                data-variant-id="${item.variantId || ''}"
                                data-multiple="${option.multiple ? 'true' : 'false'}"
                                data-accessoire="${isAccessoire ? 'true' : 'false'}"
                                data-qty="0"
                                title="${item.name}${item.price ? ' (+' + item.price + '€)' : ''}"
                                onclick="ProductOptions.toggleImageSelect(this, '${productHandle}')">
                            ${item.image ? `<img src="${item.image}" alt="${item.name}" class="option-image" loading="lazy">` : ''}
                            <span class="image-label">${item.name}</span>
                            ${item.price ? `<span class="image-price">+${item.price}€</span>` : ''}
                            <span class="check-overlay"><i class="fas fa-check-circle"></i></span>
                            ${isAccessoire ? `<div class="accessory-qty-badge" onclick="event.stopPropagation()"><span class="qty-minus" onclick="ProductOptions.changeAccessoryQty(this, '${productHandle}', -1)">−</span><span class="qty-value">1</span><span class="qty-plus" onclick="ProductOptions.changeAccessoryQty(this, '${productHandle}', 1)">+</span></div>` : ''}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    },

    /**
     * Render Select (Dropdown) Option
     */
    renderSelectOption(option, productHandle) {
        const firstValue = option.values[0];
        if (firstValue) {
            this.updateOption(productHandle, option.name, firstValue.name, firstValue.price || 0);
        }
        const hidePrice = option.label.toLowerCase().includes('nombre de roses');
        return `
            <div class="custom-option select-option">
                <label class="option-label">
                    ${option.label}
                    ${option.required ? '<span class="required">*</span>' : ''}
                </label>
                <select class="custom-select" 
                        data-option="${option.name}"
                        onchange="ProductOptions.updateSelect(this, '${productHandle}')">
                    ${option.values.map(value => `
                        <option value="${value.name}" data-price="${value.price || 0}">
                            ${value.name}${!hidePrice && value.price ? ' (+' + value.price + '€)' : ''}
                        </option>
                    `).join('')}
                </select>
            </div>
        `;
    },

    /**
     * Render Variant Select Option (ex: Nombre de roses — change la variante active)
     */
    renderVariantSelectOption(option, productHandle) {
        const firstValue = option.values[0];
        if (firstValue) {
            this.updateOption(productHandle, option.name, firstValue.name, 0);
            // Stocker le variantId de la valeur par défaut
            if (firstValue.variantId) {
                if (!this._selectedVariantIds) this._selectedVariantIds = {};
                this._selectedVariantIds[productHandle] = firstValue.variantId;
            }
        }
        return `
            <div class="custom-option variant-select-option">
                <label class="option-label">
                    ${option.label}
                    ${option.required ? '<span class="required">*</span>' : ''}
                </label>
                <select class="custom-select"
                        data-option="${option.name}"
                        onchange="ProductOptions.updateVariantSelect(this, '${productHandle}')">
                    ${option.values.map(value => `
                        <option value="${value.name}"
                                data-price="${value.price || 0}"
                                data-variant-id="${value.variantId || ''}">
                            ${value.name}${value.price > 0 ? ' (+' + value.price + '€)' : ''}
                        </option>
                    `).join('')}
                </select>
            </div>
        `;
    },

    /**
     * Render Checkbox Option (Accessories)
     */
    renderCheckboxOption(option, productHandle) {
        return `
            <div class="custom-option checkbox-option">
                <label class="option-label">${option.label}</label>
                <div class="checkbox-options-grid">
                    ${option.values.map(value => `
                        <label class="custom-checkbox-label">
                            <input type="checkbox" 
                                   class="custom-checkbox"
                                   data-option="${option.name}"
                                   data-value="${value.name}"
                                   data-price="${value.price || 0}"
                                   onchange="ProductOptions.updateCheckbox(this, '${productHandle}')">
                            <span class="checkbox-custom">
                                <i class="fas fa-check"></i>
                            </span>
                            <span class="checkbox-text">
                                ${value.name}
                                ${value.price ? '<span class="option-price">+' + value.price.toFixed(2) + '€</span>' : ''}
                            </span>
                        </label>
                    `).join('')}
                </div>
            </div>
        `;
    },

    /**
     * Render Text Input Option
     */
    renderTextOption(option, productHandle) {
        return `
            <div class="custom-option text-option">
                <label class="option-label">
                    ${option.label}
                    ${option.required ? '<span class="required">*</span>' : ''}
                </label>
                <input type="text" 
                       class="custom-text-input"
                       data-option="${option.name}"
                       data-price="${option.price || 0}"
                       placeholder="${option.placeholder || ''}"
                       maxlength="${option.maxlength || 100}"
                       oninput="ProductOptions.updateText(this, '${productHandle}')">
                ${option.maxlength ? `<small class="char-counter">0/${option.maxlength}</small>` : ''}
            </div>
        `;
    },

    /**
     * Select Color Handler
     */
    selectColor(button, productHandle) {
        const colorButtons = button.parentElement.querySelectorAll('.custom-color-button');
        colorButtons.forEach(btn => btn.classList.remove('selected'));
        button.classList.add('selected');

        const optionName = button.dataset.option;
        const value = button.dataset.value;
        const price = this.parsePrice(button.dataset.price);

        this.updateOption(productHandle, optionName, value, price);

        // Update display name
        const nameDisplay = button.closest('.color-option').querySelector('.selected-color-name');
        if (nameDisplay) {
            nameDisplay.textContent = value;
        }
    },

    /**
    /**
     * Toggle Image Select Handler (for Ymq type 8) - Multi-select
     */
    toggleImageSelect(button, productHandle) {
        const optionName = button.dataset.option;
        const value = button.dataset.value;
        const selectedPrice = this.parsePrice(button.dataset.price);
        const isMultiple = button.dataset.multiple === 'true';
        const isAccessoire = button.dataset.accessoire === 'true';

        if (!this.currentOptions[productHandle]) {
            this.currentOptions[productHandle] = {};
        }

        // Accessoire mode: clicking the card sets qty to 1 (or deselects if already selected)
        if (isAccessoire && isMultiple) {
            const currentQty = parseInt(button.dataset.qty) || 0;
            if (currentQty === 0) {
                // Select with qty 1
                button.dataset.qty = '1';
                button.classList.add('selected');
                const qtyDisplay = button.querySelector('.qty-value');
                if (qtyDisplay) qtyDisplay.textContent = '1';
            } else {
                // Deselect
                button.dataset.qty = '0';
                button.classList.remove('selected');
                const qtyDisplay = button.querySelector('.qty-value');
                if (qtyDisplay) qtyDisplay.textContent = '0';
            }
            this._syncAccessoryOptions(button, productHandle, optionName);
            return;
        }

        if (isMultiple) {
            // Multi-select : toggle
            button.classList.toggle('selected');
            const isSelected = button.classList.contains('selected');
            if (!this.currentOptions[productHandle][optionName]) {
                this.currentOptions[productHandle][optionName] = [];
            }
            if (isSelected) {
                this.currentOptions[productHandle][optionName].push({ value, price: selectedPrice });
            } else {
                this.currentOptions[productHandle][optionName] =
                    this.currentOptions[productHandle][optionName].filter(item => item.value !== value);
            }
        } else {
            // Single-select : déselectionner tous les autres dans ce groupe
            const allButtons = button.closest('.image-options-grid').querySelectorAll('.custom-image-button');
            allButtons.forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');
            this.currentOptions[productHandle][optionName] = [{ value, price: selectedPrice }];
        }

        this.updateTotalPrice(productHandle);
    },

    /**
     * Change accessory quantity via +/- buttons
     */
    changeAccessoryQty(btn, productHandle, delta) {
        const card = btn.closest('.custom-image-button');
        if (!card) return;

        let qty = parseInt(card.dataset.qty) || 0;
        qty = Math.max(0, qty + delta);
        card.dataset.qty = String(qty);

        const qtyDisplay = card.querySelector('.qty-value');
        if (qtyDisplay) qtyDisplay.textContent = String(qty);

        if (qty > 0) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }

        const optionName = card.dataset.option;
        this._syncAccessoryOptions(card, productHandle, optionName);
    },

    /**
     * Sync accessory options array after qty change
     */
    _syncAccessoryOptions(card, productHandle, optionName) {
        if (!this.currentOptions[productHandle]) {
            this.currentOptions[productHandle] = {};
        }

        // Rebuild the entire option array from all cards in this group
        const grid = card.closest('.image-options-grid');
        const allCards = grid.querySelectorAll('.custom-image-button');
        const items = [];

        allCards.forEach(c => {
            const qty = parseInt(c.dataset.qty) || 0;
            if (qty > 0) {
                items.push({
                    value: c.dataset.value,
                    price: this.parsePrice(c.dataset.price),
                    qty: qty
                });
            }
        });

        this.currentOptions[productHandle][optionName] = items;
        this.updateTotalPrice(productHandle);
    },

    /**
     * Select Image Handler (for Ymq type 8) - Legacy single select (kept for compatibility)
     */
    selectImage(button, productHandle) {
        // Redirect to multi-select handler
        this.toggleImageSelect(button, productHandle);
    },

    /**
     * Update Select Handler
     */
    updateSelect(select, productHandle) {
        const optionName = select.dataset.option;
        const selectedOption = select.options[select.selectedIndex];
        const value = selectedOption.value;
        const price = this.parsePrice(selectedOption.dataset.price);

        this.updateOption(productHandle, optionName, value, price);
    },

    /**
     * Update Variant Select Handler — change la variante active Shopify
     */
    updateVariantSelect(select, productHandle) {
        const optionName = select.dataset.option;
        const selectedOption = select.options[select.selectedIndex];
        const value = selectedOption.value;
        const variantId = selectedOption.dataset.variantId;
        // Prix d'option Ymq (surcoût éventuel)
        const ymqPrice = this.parsePrice(selectedOption.dataset.price);

        // Stocker le variantId sélectionné pour addToCart
        if (!this._selectedVariantIds) this._selectedVariantIds = {};
        if (variantId) this._selectedVariantIds[productHandle] = variantId;

        this.updateOption(productHandle, optionName, value, ymqPrice);

        // Sinon utiliser le prix de la variante Shopify
        if (variantId && typeof ShopifyIntegration !== 'undefined') {
            const product = ShopifyIntegration.products.find(p => p.handle === productHandle);
            if (product) {
                const variant = product.variants.edges
                    .map(e => e.node)
                    .find(v => String(v.id).includes(variantId) || String(v.id).endsWith('/' + variantId));
                if (variant) {
                    const price = this.parsePrice(variant.priceV2?.amount || variant.price || 0);
                    ShopifyIntegration._basePrice = price;
                    const priceEl = document.querySelector('.product-details-price .price-current');
                    if (priceEl) {
                        priceEl.setAttribute('data-base-price', price);
                        this.updateTotalPrice(productHandle);
                    }
                }
            }
        }
    },

    /**
     * Update Checkbox Handler
     */
    updateCheckbox(checkbox, productHandle) {
        const optionName = checkbox.dataset.option;
        const value = checkbox.dataset.value;
        const price = this.parsePrice(checkbox.dataset.price);

        if (!this.currentOptions[productHandle]) {
            this.currentOptions[productHandle] = {};
        }

        if (!this.currentOptions[productHandle][optionName]) {
            this.currentOptions[productHandle][optionName] = [];
        }

        if (checkbox.checked) {
            this.currentOptions[productHandle][optionName].push({
                value: value,
                price: price
            });
        } else {
            this.currentOptions[productHandle][optionName] = 
                this.currentOptions[productHandle][optionName].filter(item => item.value !== value);
        }

        this.updateTotalPrice(productHandle);
    },

    /**
     * Update Text Input Handler
     */
    updateText(input, productHandle) {
        const optionName = input.dataset.option;
        const value = input.value;
        // Only charge the price when the user has actually typed something
        const price = value.trim() ? this.parsePrice(input.dataset.price) : 0;

        this.updateOption(productHandle, optionName, value, price);

        // Update character counter
        const counter = input.parentElement.querySelector('.char-counter');
        if (counter) {
            const maxLength = input.maxLength;
            counter.textContent = `${value.length}/${maxLength}`;
        }
    },

    /**
     * Update a single option
     */
    updateOption(productHandle, optionName, value, price) {
        if (!this.currentOptions[productHandle]) {
            this.currentOptions[productHandle] = {};
        }

        this.currentOptions[productHandle][optionName] = {
            value: value,
            price: price
        };

        this.updateTotalPrice(productHandle);
    },

    /**
     * Update total price display
     */
    updateTotalPrice(productHandle) {
        const basePrice = this.getBasePrice();
        const optionsPrice = this.calculateOptionsPrice(productHandle);
        const totalPrice = basePrice + optionsPrice;

        const priceElement = document.querySelector('.product-details-price .price-current');
        if (priceElement) {
            const formatted = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(totalPrice);
            priceElement.textContent = formatted;
        }
    },

    /**
     * Get base product price
     */
    getBasePrice() {
        // Priorité 1 : data-base-price dans le DOM (valeur fixe au chargement)
        const priceElement = document.querySelector('.product-details-price .price-current');
        if (priceElement) {
            const priceText = priceElement.getAttribute('data-base-price');
            if (priceText) return this.parsePrice(priceText);
        }
        
        // Priorité 2 : _basePrice stocké par ShopifyIntegration
        if (typeof ShopifyIntegration !== 'undefined' && ShopifyIntegration._basePrice !== undefined) {
            return ShopifyIntegration._basePrice;
        }
        
        return 0;
    },

    /**
     * Calculate total price of selected options
     */
    calculateOptionsPrice(productHandle) {
        const options = this.currentOptions[productHandle];
        if (!options) return 0;

        let total = 0;

        Object.values(options).forEach(option => {
            if (Array.isArray(option)) {
                // Checkbox / multi-select options (multiple values)
                option.forEach(item => {
                    const qty = item.qty || 1;
                    total += (item.price || 0) * qty;
                });
            } else {
                // Single value options
                total += option.price || 0;
            }
        });

        return total;
    },

    /**
     * Get selected options for a product
     */
    getSelectedOptions(productHandle) {
        return this.currentOptions[productHandle] || {};
    },

    /**
     * Format options for cart
     */
    formatOptionsForCart(productHandle) {
        const options = this.getSelectedOptions(productHandle);
        const allOptions = this.getOptions(productHandle) || [];
        const formatted = [];

        // Build a map from option.name → option.label for lookup
        const labelMap = {};
        allOptions.forEach(opt => { labelMap[opt.name] = opt.label || opt.name; });

        Object.entries(options).forEach(([key, value]) => {
            const label = labelMap[key] || key;
            if (Array.isArray(value)) {
                // Checkbox / multi-select options
                value.forEach(item => {
                    const qty = item.qty || 1;
                    formatted.push({
                        name: key,
                        label: label,
                        value: qty > 1 ? `${item.value} x${qty}` : item.value,
                        price: (item.price || 0) * qty,
                        qty: qty
                    });
                });
            } else {
                // Single value options
                formatted.push({
                    name: key,
                    label: label,
                    value: value.value,
                    price: value.price
                });
            }
        });

        return formatted;
    },

    /**
     * Validate required options
     */
    validateOptions(productHandle) {
        const productOptions = this.getOptions(productHandle);
        if (!productOptions) return true;

        const selectedOptions = this.getSelectedOptions(productHandle);

        for (const option of productOptions) {
            if (option.required) {
                if (!selectedOptions[option.name] || 
                    (Array.isArray(selectedOptions[option.name]) && selectedOptions[option.name].length === 0)) {
                    alert(`Veuillez sélectionner: ${option.label}`);
                    return false;
                }
            }
        }

        return true;
    },

    /**
     * Reset options for a product
     */
    resetOptions(productHandle) {
        this.currentOptions[productHandle] = {};
    },

    /**
     * Configuration for multi-select options
     * Define which option labels should allow multiple selections
     */
    getMultiSelectOptions() {
        return {
            // Options that should be multi-selectable (by label pattern)
            'global': [
                'Accessoire',
                'Personnalisation',
                'Accessoires',
                'Personnalisations'
            ],
            // Product-specific overrides
            'bouquet-de-roses-offrir-metz': [
                'Personnalisation(s)',
                'Accéssoire(s)'
            ],
            'coffret-coeur': [
                'Accessoires',
                'Personnalisation'
            ]
        };
    },

    /**
     * Keywords identifying "Accessoire" option categories
     */
    getAccessoireKeywords() {
        return ['accessoire', 'accéssoire', 'accessoires', 'accéssoires', 'accessory', 'accessories'];
    },

    /**
     * Check if an option belongs to the "Accessoire" category
     */
    isAccessoireOption(option) {
        const keywords = this.getAccessoireKeywords();
        const label = (option.label || '').toLowerCase();
        const name = (option.name || '').toLowerCase();
        return keywords.some(kw => label.includes(kw) || name.includes(kw));
    },

    /**
     * Apply option transformations (emballage conversion, multi-select config)
     */
    applyPriceCorrections(options, productHandle) {
        const multiSelectConfig = this.getMultiSelectOptions();
        
        if (!Array.isArray(options)) {
            return;
        }

        // Get multi-select labels for this product
        const globalMultiSelect = multiSelectConfig['global'] || [];
        const productMultiSelect = multiSelectConfig[productHandle] || [];
        const allMultiSelectPatterns = [...globalMultiSelect, ...productMultiSelect];

        // Keywords that identify packaging/emballage options to convert to image-select cards
        const emballageKeywords = ['emballage', 'packaging', 'wrapping'];

        options.forEach(option => {
            // Convert emballage/packaging dropdown to image-select cards (like Personnalisation/Accessoire)
            if (option.type === 'select') {
                const isEmballage = emballageKeywords.some(kw =>
                    option.label.toLowerCase().includes(kw) || option.name.toLowerCase().includes(kw)
                );
                if (isEmballage && Array.isArray(option.values) && option.values.length > 0) {
                    option.type = 'image-select';
                    option.multiple = false; // single selection for packaging
                    option.values = option.values.map(v => ({
                        name: v.name,
                        price: v.price || 0,
                        image: v.image || '', // may be empty — CSS handles no-image cards
                        variantId: v.variantId || ''
                    }));
                }
            }

            // Check if this option should be multi-select
            if (option.type === 'image-select' && !option.multiple) {
                const shouldBeMultiple = allMultiSelectPatterns.some(pattern => 
                    option.label.toLowerCase().includes(pattern.toLowerCase())
                );
                if (shouldBeMultiple) {
                    option.multiple = true;
                }
            }

            // Prices now come directly from Ymq
        });
    },

    /**
     * Default configuration (fallback)
     */
    getDefaultConfig() {
        return {
            'box-coeur-kinder': [
                {
                    name: 'flower_color',
                    label: 'Couleur de la fleur',
                    type: 'color',
                    required: true,
                    values: [
                        { name: 'Rose', hex: '#FFB6C1', price: 0 },
                        { name: 'Rouge', hex: '#FF0000', price: 0 },
                        { name: 'Blanc', hex: '#FFFFFF', price: 0 },
                        { name: 'Jaune', hex: '#FFFF00', price: 0 }
                    ]
                },
                {
                    name: 'chocolate_type',
                    label: 'Type de chocolat',
                    type: 'select',
                    required: true,
                    values: [
                        { name: 'Kinder Bueno', price: 0 },
                        { name: 'Kinder Chocolate', price: 0 },
                        { name: 'Kinder Country', price: 1.5 },
                        { name: 'Kinder Maxi', price: 2.0 },
                        { name: 'Mix Kinder', price: 1.0 }
                    ]
                },
                {
                    name: 'accessories',
                    label: 'Accessoires',
                    type: 'checkbox',
                    required: false,
                    values: [
                        { name: 'Papillon décoratif', price: 2.5 },
                        { name: 'Carte "Happy Birthday"', price: 1.5 },
                        { name: 'Ruban personnalisé', price: 2.0 }
                    ]
                }
            ]
        };
    }
};
