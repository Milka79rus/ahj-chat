const createRequest = async (options) => {
  const { url, method = 'GET', data } = options;

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      // Если есть данные, превращаем их в строку JSON
      body: data ? JSON.stringify(data) : undefined,
    });

    const result = await response.json();

    // Если сервер ответил ошибкой (например, статус 400 или 409)
    if (!response.ok) {
      throw new Error(result.message || 'Ошибка сети');
    }

    return result; // Возвращаем { status: "ok", user: {...} }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Ошибка запроса:', error);
    throw error; // Пробрасываем ошибку дальше, чтобы поймать её в Chat.js
  }
};

export default createRequest;
