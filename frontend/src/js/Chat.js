export default class Chat {
  constructor(container) {
    this.container = container;
    this.websocket = null;
    this.currentUser = null;
  }

  init() {
    this.bindToDOM();
    this.registerEvents();
    this.subscribeOnEvents();
  }

  // Отрисовка базовой структуры
  bindToDOM() {
    this.container.innerHTML = `
      <div class="modal__form active" id="auth-modal">
        <div class="modal__background"></div>
        <div class="modal__content">
          <div class="modal__header">Выберите псевдоним</div>
          <div class="modal__body">
            <div class="form__group">
              <label class="form__label" for="nickname-input">Введите ваш никнейм для входа в чат:</label>
              <input class="form__input" type="text" id="nickname-input" placeholder="Например, Vasya_Ivanov">
              <div class="form__hint hidden" id="modal-error">Это имя уже занято!</div>
            </div>
          </div>
          <div class="modal__footer">
            <button class="modal__ok" id="auth-submit-btn">Войти</button>
          </div>
        </div>
      </div>

      <div class="chat__container hidden" id="chat-window">
        <div class="chat__userlist" id="user-list"></div>
        <div class="chat__area">
          <div class="chat__messages-container" id="messages-container"></div>
          <div class="chat__messages-input">
            <form class="form" id="message-form">
              <div class="form__group">
                <input class="form__input" type="text" id="message-input" placeholder="Напишите сообщение и нажмите Enter...">
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  }

  registerEvents() {
    const authBtn = this.container.querySelector('#auth-submit-btn');
    const nicknameInput = this.container.querySelector('#nickname-input');
    const messageForm = this.container.querySelector('#message-form');

    // Авторизация
    authBtn.addEventListener('click', () => this.onEnterChatHandler());
    nicknameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.onEnterChatHandler();
    });

    // Отправка сообщений в чат
    messageForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.sendMessage();
    });
  }

  // Логика отправки запроса на логин ВНУТРЬ СОКЕТА
  onEnterChatHandler() {
    const nicknameInput = this.container.querySelector('#nickname-input');
    const errorHint = this.container.querySelector('#modal-error');
    const name = nicknameInput.value.trim();
    // eslint-disable-next-line no-console
    console.log('Клик сработал! Введенное имя:', name);
    if (this.websocket) {
      // eslint-disable-next-line no-console
      console.log('Статус сокета (readyState):', this.websocket.readyState, 'Ожидаем OPEN (1):', WebSocket.OPEN);
    }

    if (!name) {
      errorHint.textContent = 'Имя не может быть пустым!';
      errorHint.classList.remove('hidden');
      return;
    }

    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      errorHint.textContent = 'Сервер чата недоступен. Подождите...';
      errorHint.classList.remove('hidden');
      return;
    }
    // eslint-disable-next-line no-console
    console.log('Отправляем данные на сервер...');
    this.websocket.send(
      JSON.stringify({
        type: 'login',
        user: { name },
      }),
    );
  }

  // Подключение к WebSocket и разбор всех типов ответов
  subscribeOnEvents() {
    const isLocal = window.location.hostname === 'localhost';
    const wsUrl = isLocal ? 'ws://localhost:3000' : 'wss://ahj-backend-milka-milka79rus.amvera.io';

    this.websocket = new WebSocket(wsUrl);

    this.websocket.addEventListener('open', () => {
      // eslint-disable-next-line no-console
      console.log('WebSocket connection opened');
    });

    this.websocket.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);

      // СЦЕНАРИЙ 1: Ошибка логина (имя занято)
      if (msg.type === 'error') {
        const errorHint = this.container.querySelector('#modal-error');
        errorHint.textContent = msg.message;
        errorHint.classList.remove('hidden');
      }
      // СЦЕНАРИЙ 2: Успешный вход
      else if (msg.type === 'login_success') {
        this.currentUser = msg.user;
        const authModal = this.container.querySelector('#auth-modal');
        authModal.classList.remove('active');
        authModal.classList.add('hidden');
        this.container.querySelector('#chat-window').classList.remove('hidden');
      }
      // СЦЕНАРИЙ 3: Сервер прислал обновленный список юзеров
      else if (msg.type === 'users') {
        this.renderUserList(msg.data);
      }
      // СЦЕНАРИЙ 4: Прилетело новое сообщение в чат
      else if (msg.type === 'send') {
        this.renderMessage(msg.data);
      }
    });

    this.websocket.addEventListener('close', () => {
      // eslint-disable-next-line no-console
      console.log('WebSocket closed, attempting reconnect...');
      this.reconnect();
    });

    this.websocket.addEventListener('error', () => {
      // eslint-disable-next-line no-alert
      alert('Произошла ошибка соединения с сервером');
    });
  }

  reconnect() {
    this.websocket = null;
    setTimeout(() => {
      this.subscribeOnEvents();
    }, 3000);
  }

  // Отправка сообщения строго по структуре бэкенда
  sendMessage() {
    const messageInput = this.container.querySelector('#message-input');
    const text = messageInput.value.trim();

    if (!text || !this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;

    this.websocket.send(
      JSON.stringify({
        type: 'send',
        data: { message: text, user: this.currentUser },
      }),
    );
    messageInput.value = '';
  }

  // Отрисовка сообщения на экране
  renderMessage(msg) {
    const messagesContainer = this.container.querySelector('#messages-container');
    const messageEl = document.createElement('div');
    const isMe = this.currentUser && msg.user.name === this.currentUser.name;
    const formattedDate = new Date().toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    messageEl.className = `message__container ${
      isMe ? 'message__container-yourself' : 'message__container-interlocutor'
    }`;
    messageEl.innerHTML = `
      <div class="message__header">${isMe ? 'You' : msg.user.name}, ${formattedDate}</div>
      <div class="message__text">${msg.message}</div>
    `;
    messagesContainer.appendChild(messageEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  renderUserList(users) {
    const userListContainer = this.container.querySelector('#user-list');
    userListContainer.innerHTML = '';
    users.forEach((user) => {
      const userEl = document.createElement('div');
      userEl.className = 'chat__user';
      if (this.currentUser && user.name === this.currentUser.name) {
        userEl.textContent = `${user.name} (You)`;
        userEl.style.fontWeight = 'bold';
      } else {
        userEl.textContent = user.name;
      }
      userListContainer.appendChild(userEl);
    });
  }
}
