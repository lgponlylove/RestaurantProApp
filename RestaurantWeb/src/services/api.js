import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5296';

export const api = {
    getTables: async () => {
        const res = await fetch(`${API_BASE_URL}/api/tables`);
        return res.json();
    },
    getMenuItems: async () => {
        const res = await fetch(`${API_BASE_URL}/api/menu`);
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

    async sendNewOrder(tableId, orderDetails, ticketId) {
        if (this.connection) {
            await this.connection.invoke("SendNewOrder", tableId, orderDetails, ticketId);
        }
    }

    async checkoutTable(tableId) {
        if (this.connection) {
            await this.connection.invoke("CheckoutTable", tableId);
        }
    }

    async markItemCooked(ticketId, tableId) {
        if (this.connection) {
            await this.connection.invoke("MarkItemCooked", ticketId, tableId);
        }
    }
}

export const signalRService = new SignalRService();
