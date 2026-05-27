import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5296';

const getHeaders = (hasBody = false) => {
    const headers = {};
    if (hasBody) {
        headers['Content-Type'] = 'application/json';
    }
    const token = localStorage.getItem('token');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
};

export const api = {
    login: async (username, password) => {
        const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.message || 'Đăng nhập thất bại');
        }
        return res.json();
    },
    getTables: async () => {
        const res = await fetch(`${API_BASE_URL}/api/tables`, {
            headers: getHeaders()
        });
        return res.json();
    },
    addTable: async (table) => {
        const res = await fetch(`${API_BASE_URL}/api/tables`, {
            method: 'POST',
            headers: getHeaders(true),
            body: JSON.stringify(table)
        });
        return res.json();
    },
    editTable: async (id, table) => {
        const res = await fetch(`${API_BASE_URL}/api/tables/${id}`, {
            method: 'PUT',
            headers: getHeaders(true),
            body: JSON.stringify(table)
        });
        return res.json();
    },
    deleteTable: async (id) => {
        const res = await fetch(`${API_BASE_URL}/api/tables/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        return res.json();
    },
    getMenuItems: async () => {
        const res = await fetch(`${API_BASE_URL}/api/menu`, {
            headers: getHeaders()
        });
        return res.json();
    },
    getActiveOrders: async () => {
        const res = await fetch(`${API_BASE_URL}/api/orders/active`, {
            headers: getHeaders()
        });
        return res.json();
    },
    // Endpoint công khai: Khách xem món đã gọi theo bàn (không cần đăng nhập)
    getTableOrders: async (tableId) => {
        const res = await fetch(`${API_BASE_URL}/api/orders/table/${tableId}`);
        return res.json();
    },
    getInvoices: async () => {
        const res = await fetch(`${API_BASE_URL}/api/invoices`, {
            headers: getHeaders()
        });
        return res.json();
    },
    addMenuItem: async (item) => {
        const res = await fetch(`${API_BASE_URL}/api/menu`, {
            method: 'POST',
            headers: getHeaders(true),
            body: JSON.stringify(item)
        });
        return res.json();
    },
    editMenuItem: async (id, item) => {
        const res = await fetch(`${API_BASE_URL}/api/menu/${id}`, {
            method: 'PUT',
            headers: getHeaders(true),
            body: JSON.stringify(item)
        });
        return res.json();
    },
    deleteMenuItem: async (id) => {
        const res = await fetch(`${API_BASE_URL}/api/menu/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        return res.json();
    },
    placeOrder: async (orderData) => {
        const res = await fetch(`${API_BASE_URL}/api/orders`, {
            method: 'POST',
            headers: getHeaders(true),
            body: JSON.stringify(orderData)
        });
        return res.json();
    },
    approveOrder: async (id) => {
        const res = await fetch(`${API_BASE_URL}/api/orders/${id}/approve`, {
            method: 'PUT',
            headers: getHeaders()
        });
        return res.json();
    },
    deleteOrder: async (id) => {
        const res = await fetch(`${API_BASE_URL}/api/orders/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        return res.json();
    },
    updateOrder: async (id, orderData) => {
        const res = await fetch(`${API_BASE_URL}/api/orders/${id}`, {
            method: 'PUT',
            headers: getHeaders(true),
            body: JSON.stringify(orderData)
        });
        return res.json();
    },
    getRevenueStats: async () => {
        const res = await fetch(`${API_BASE_URL}/api/stats/revenue`, {
            headers: getHeaders()
        });
        return res.json();
    },
    getCancelledOrders: async () => {
        const res = await fetch(`${API_BASE_URL}/api/cancelled-orders`, {
            headers: getHeaders()
        });
        return res.json();
    },
    transferTable: async (sourceTableId, targetTableId) => {
        const res = await fetch(`${API_BASE_URL}/api/tables/transfer`, {
            method: 'POST',
            headers: getHeaders(true),
            body: JSON.stringify({ sourceTableId, targetTableId })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Lỗi chuyển bàn');
        }
        return res.json();
    }
};

class SignalRService {
    constructor() {
        this.connection = null;
        this.listeners = {};
    }

    async startConnection() {
        if (this.connection) return;

        this.connection = new HubConnectionBuilder()
            .withUrl(`${API_BASE_URL}/orderHub`)
            .configureLogging(LogLevel.Information)
            .withAutomaticReconnect()
            .build();

        this.connection.on("ReceiveNewOrder", (tableId, orderDetails, ticketId) => {
            this.emit("ReceiveNewOrder", { tableId, orderDetails, ticketId });
        });

        this.connection.on("ReceivePendingOrder", (tableId, orderDetails, ticketId, totalAmount, orderId) => {
            this.emit("ReceivePendingOrder", { tableId, orderDetails, ticketId, totalAmount, orderId });
        });

        this.connection.on("ReceiveCheckoutRequest", (tableId, tableName) => {
            this.emit("ReceiveCheckoutRequest", { tableId, tableName });
        });

        this.connection.on("ItemCooked", (ticketId, tableId) => {
            this.emit("ItemCooked", { ticketId, tableId });
        });

        this.connection.on("TableCheckedOut", (tableId) => {
            this.emit("TableCheckedOut", { tableId });
        });

        try {
            await this.connection.start();
            console.log("SignalR Connected.");
        } catch (err) {
            console.error("SignalR Connection Error: ", err);
        }
    }

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    off(event, callback) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }

    emit(event, data) {
        if (!this.listeners[event]) return;
        this.listeners[event].forEach(cb => cb(data));
    }

    async sendNewOrder(tableId, orderDetails, ticketId, totalAmount) {
        if (this.connection) {
            await this.connection.invoke("SendNewOrder", tableId, orderDetails, ticketId, totalAmount);
        }
    }

    async requestCheckout(tableId) {
        if (this.connection) {
            await this.connection.invoke("RequestCheckout", tableId);
        }
    }

    async checkoutTable(tableId, paymentMethod = "Tiền mặt") {
        if (this.connection) {
            await this.connection.invoke("CheckoutTable", tableId, paymentMethod);
        }
    }

    async markItemCooked(ticketId, tableId) {
        if (this.connection) {
            await this.connection.invoke("MarkItemCooked", ticketId, tableId);
        }
    }
}

export const signalRService = new SignalRService();
