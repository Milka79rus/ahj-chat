import ChatAPI from './api/ChatAPI';

export default class Chat {
  constructor(container) {
    this.container = container;
    this.api = new ChatAPI();
    this.websocket = null;
    this.currentUser = null; // Данные текущего пользователя { id, name }
  }

  init() {
    this.bindToDOM();
    this.registerEvents();
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
        <div class="chat__userlist" id="user-list">
          </div>
        <div class="chat__area">
          <div class="chat__messages-container" id="messages-container">
            </div>
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

  // Навешиваем обработчики событий
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

  // Логика отправки ника на сервер
  async onEnterChatHandler() {
    const nicknameInput = this.container.querySelector('#nickname-input');
    const errorHint = this.container.querySelector('#modal-error');
    const name = nicknameInput.value.trim();

    if (!name) {
      errorHint.textContent = 'Имя не может быть пустым!';
      errorHint.classList.remove('hidden');
      return;
    }

    try {
      const response = await this.api.login(name);

      if (response.status === 'ok') {
        this.currentUser = response.user;

        this.container.querySelector('#auth-modal').classList.remove('active');
        this.container.querySelector('#chat-window').classList.remove('hidden');

        // Успешно залогинились — открываем WebSocket!
        this.subscribeOnEvents();
      }
    } catch (error) {
      errorHint.textContent = error.message || 'Этот никнейм уже занято!';
      errorHint.classList.remove('hidden');
    }
  }

  // Подключение к WebSocket и подписка на события сервера
  subscribeOnEvents() {
    // Проверяем, где запущен фронтенд
    const isLocal = window.location.hostname === 'localhost';

    // Выбираем правильный адрес сокета (ws для локалки, wss для деплоя)
    const wsUrl = isLocal ? 'ws://localhost:3000' : 'wss://ahj-backend-milka-milka79rus.amvera.io';

    // Открываем сокет-соединение
    this.websocket = new WebSocket(wsUrl);

    // Слушаем сообщения от сервера
    this.websocket.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);

      // Сервер присылает либо массив юзеров, либо объект сообщения
      if (Array.isArray(data)) {
        this.renderUserList(data);
      } else if (data.type === 'send') {
        this.renderMessage(data);
      }
    });

    // Красиво выходим из чата при закрытии вкладки браузера
    window.addEventListener('beforeunload', () => {
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        this.websocket.send(
          JSON.stringify({
            type: 'exit',
            user: this.currentUser,
          }),
        );
      }
    });
  }

  // Отправка сообщения на сервер
  sendMessage() {
    const messageInput = this.container.querySelector('#message-input');
    const text = messageInput.value.trim();

    if (!text || !this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      return;
    }

    // Собираем объект сообщения строго по спецификации бэкенда
    const messageData = {
      type: 'send',
      message: text,
      user: this.currentUser,
    };

    this.websocket.send(JSON.stringify(messageData));
    messageInput.value = ''; // Очищаем поле ввода
  }

  // Отрисовка сообщения на экране
  renderMessage(msg) {
    const messagesContainer = this.container.querySelector('#messages-container');
    const messageEl = document.createElement('div');

    // Проверяем, наше ли это сообщение
    const isMe = msg.user.name === this.currentUser.name;

    // Генерируем красивую дату в формате ЧЧ:ММ ДД.ММ.ГГГГ
    const formattedDate = new Date()
      .toLocaleString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
      .replace(',', '');

    if (isMe) {
      // Мои сообщения — вправо, имя меняем на "You"
      messageEl.className = 'message__container message__container-yourself';
      messageEl.innerHTML = `
        <div class="message__header">You, ${formattedDate}</div>
        <div class="message__text">${msg.message}</div>
      `;
    } else {
      // Чужие сообщения — влево, пишем реальный никнейм
      messageEl.className = 'message__container message__container-interlocutor';
      messageEl.innerHTML = `
        <div class="message__header">${msg.user.name}, ${formattedDate}</div>
        <div class="message__text">${msg.message}</div>
      `;
    }

    messagesContainer.appendChild(messageEl);

    // Автоматический скролл вниз при получении новых сообщений
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Отрисовка списка пользователей слева
  renderUserList(users) {
    const userListContainer = this.container.querySelector('#user-list');
    userListContainer.innerHTML = ''; // Очищаем старый список

    users.forEach((user) => {
      const userEl = document.createElement('div');
      userEl.className = 'chat__user';

      // Выделяем себя в списке для удобства
      if (user.name === this.currentUser.name) {
        userEl.textContent = `${user.name} (You)`;
        userEl.style.fontWeight = 'bold';
      } else {
        userEl.textContent = user.name;
      }

      userListContainer.appendChild(userEl);
    });
  }
}
