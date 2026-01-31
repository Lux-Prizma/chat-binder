/**
 * DateFilter - Handles date range filtering for conversations
 */

export class DateFilter {
    constructor(eventBus, data, onFilterChange) {
        this.eventBus = eventBus;
        this.data = data;
        this.onFilterChange = onFilterChange;
        this.filter = {
            active: false,
            type: 'createTime',
            startDate: null,
            endDate: null
        };
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById('filterBtn').addEventListener('click', () => {
            this.showDialog();
        });

        document.getElementById('cancelDateFilter').addEventListener('click', () => {
            this.hideDialog();
        });

        document.getElementById('resetDateFilter').addEventListener('click', () => {
            this.reset();
        });

        document.getElementById('applyDateFilter').addEventListener('click', () => {
            this.apply();
        });
    }

    showDialog() {
        const dialog = document.getElementById('dateFilterDialog');
        dialog.style.display = 'flex';

        // Set current filter type
        const radioButtons = document.querySelectorAll('input[name="filterType"]');
        radioButtons.forEach(radio => {
            if (radio.value === this.filter.type) {
                radio.checked = true;
            }
        });

        // Set current date values
        if (this.filter.startDate) {
            document.getElementById('startDate').value = this.filter.startDate;
        }
        if (this.filter.endDate) {
            document.getElementById('endDate').value = this.filter.endDate;
        }
    }

    hideDialog() {
        document.getElementById('dateFilterDialog').style.display = 'none';
    }

    async reset() {
        this.filter = {
            active: false,
            type: 'createTime',
            startDate: null,
            endDate: null
        };

        // Clear date inputs
        document.getElementById('startDate').value = '';
        document.getElementById('endDate').value = '';

        this.hideDialog();
        if (this.onFilterChange) {
            this.onFilterChange();
        }
    }

    async apply() {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const filterType = document.querySelector('input[name="filterType"]:checked').value;

        if (!startDate && !endDate) {
            alert('Please select at least a start date or end date.');
            return;
        }

        this.filter = {
            active: true,
            type: filterType,
            startDate: startDate || null,
            endDate: endDate || null
        };

        this.hideDialog();
        if (this.onFilterChange) {
            this.onFilterChange();
        }
    }

    matches(conv) {
        if (!this.filter.active) {
            return true;
        }

        const startTimestamp = this.filter.startDate ?
            new Date(this.filter.startDate).getTime() / 1000 : 0;
        const endTimestamp = this.filter.endDate ?
            new Date(this.filter.endDate).getTime() / 1000 + 86400 :
            Infinity;

        switch (this.filter.type) {
            case 'createTime':
                return conv.createTime >= startTimestamp && conv.createTime <= endTimestamp;
            case 'updateTime':
                return conv.updateTime >= startTimestamp && conv.updateTime <= endTimestamp;
            case 'hasMessagesInRange':
                return this.hasMessagesInRange(conv, startTimestamp, endTimestamp);
            default:
                return true;
        }
    }

    hasMessagesInRange(conv, startTimestamp, endTimestamp) {
        return conv.pairs.some(pair => {
            // Check question timestamp
            if (pair.question.timestamp >= startTimestamp && pair.question.timestamp <= endTimestamp) {
                return true;
            }
            // Check answer timestamps
            return pair.answers.some(ans =>
                ans.timestamp >= startTimestamp && ans.timestamp <= endTimestamp
            );
        });
    }
}
