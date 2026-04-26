// Cloudflare Worker для CodeBattles
// Использует KV Storage для хранения данных

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // CORS заголовки
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Получить все данные
    if (path === '/api/data' && request.method === 'GET') {
      try {
        const data = await env.CODEBATTLES_KV.get('global_data', 'json');
        if (data) {
          return new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        } else {
          // Начальные данные
          const defaultData = {
            users: [
              { id: 1, username: "admin", password: "admin123", avatar: "AD", points: 580, solved: [1,2,4], rating: 1120 },
              { id: 2, username: "petya", password: "123", avatar: "PM", points: 210, solved: [1], rating: 890 }
            ],
            submissions: [],
            problems: [
              { id:1, title:"A + B", difficulty:"easy", points:100, testInput:"3 5", expectedOutput:"8", description:"Даны два целых числа A и B. Найдите их сумму." },
              { id:2, title:"Четное или нечетное", difficulty:"easy", points:100, testInput:"7", expectedOutput:"нечетное", description:"Проверьте, является ли число четным." },
              { id:3, title:"Факториал", difficulty:"medium", points:200, testInput:"5", expectedOutput:"120", description:"Вычислите факториал числа n (n ≤ 10)." },
              { id:4, title:"Максимум трех", difficulty:"medium", points:200, testInput:"10 25 15", expectedOutput:"25", description:"Найдите наибольшее из трех чисел." },
              { id:5, title:"Сумма массива", difficulty:"hard", points:300, testInput:"3\n1 2 3", expectedOutput:"6", description:"Найдите сумму элементов массива." }
            ],
            news: [
              { title:"Добро пожаловать в CodeBattles!", date:"15.04.2025", content:"Платформа для настоящих баталий кода." },
              { title:"Первый турнир", date:"18.04.2025", content:"Соревнование на 1000 очков рейтинга." }
            ]
          };
          await env.CODEBATTLES_KV.put('global_data', JSON.stringify(defaultData));
          return new Response(JSON.stringify(defaultData), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders }
        });
      }
    }
    
    // Сохранить данные
    if (path === '/api/data' && request.method === 'POST') {
      try {
        const newData = await request.json();
        await env.CODEBATTLES_KV.put('global_data', JSON.stringify(newData));
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders }
        });
      }
    }
    
    // Регистрация/вход
    if (path === '/api/auth' && request.method === 'POST') {
      const { username, password, action } = await request.json();
      const data = await env.CODEBATTLES_KV.get('global_data', 'json');
      
      if (action === 'login') {
        const user = data.users.find(u => u.username === username && u.password === password);
        if (user) {
          const { password, ...safeUser } = user;
          return new Response(JSON.stringify({ success: true, user: safeUser }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
        return new Response(JSON.stringify({ success: false, error: 'Неверные данные' }), {
          status: 401,
          headers: { ...corsHeaders }
        });
      }
      
      if (action === 'register') {
        if (data.users.find(u => u.username === username)) {
          return new Response(JSON.stringify({ success: false, error: 'Пользователь уже существует' }), {
            status: 400,
            headers: { ...corsHeaders }
          });
        }
        const newUser = {
          id: Date.now(),
          username,
          password,
          avatar: username.slice(0,2).toUpperCase(),
          points: 0,
          solved: [],
          rating: 1000
        };
        data.users.push(newUser);
        await env.CODEBATTLES_KV.put('global_data', JSON.stringify(data));
        const { password: _, ...safeUser } = newUser;
        return new Response(JSON.stringify({ success: true, user: safeUser }), {
          headers: { ...corsHeaders }
        });
      }
    }
    
    // Обновить пользователя (после решения задачи)
    if (path === '/api/user/update' && request.method === 'POST') {
      const { id, points, solved } = await request.json();
      const data = await env.CODEBATTLES_KV.get('global_data', 'json');
      const userIndex = data.users.findIndex(u => u.id === id);
      if (userIndex !== -1) {
        if (points !== undefined) data.users[userIndex].points = points;
        if (solved !== undefined) data.users[userIndex].solved = solved;
        await env.CODEBATTLES_KV.put('global_data', JSON.stringify(data));
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders }
        });
      }
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders }
      });
    }
    
    // Рейтинг
    if (path === '/api/leaderboard' && request.method === 'GET') {
      const data = await env.CODEBATTLES_KV.get('global_data', 'json');
      const leaderboard = data.users
        .sort((a, b) => b.points - a.points)
        .map((u, i) => ({ rank: i+1, username: u.username, points: u.points, solved: u.solved.length }));
      return new Response(JSON.stringify(leaderboard), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    return new Response('CodeBattles API v2.0 - Работает!', {
      headers: { ...corsHeaders }
    });
  }
}
