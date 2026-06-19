import Entity from './Entity';
import createRequest from './createRequest';

export default class ChatAPI extends Entity {
    constructor() {
        super();
        // Если открыто на localhost, стучимся на локальный сервер, иначе — на Amvera
        const isLocal = window.location.hostname === 'localhost';
        this.apiUrl = isLocal
            ? 'http://localhost:3000/new-user'
            : 'https://ahj-backend-milka-milka79rus.amvera.io/new-user';
    }

    async login(name) {
        return createRequest({
            url: this.apiUrl,
            method: 'POST',
            data: { name },
        });
    }
}
