// Cloudflare Worker для CodeBattles
// Хранилище данных в GitHub репозитории

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // CORS заголовки для доступа с любого источника
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    
    // Обработка preflight запросов
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Получить все данные
    if (path === '/api/data' && request.method === 'GET') {
      try {
        const response = await fetch(
          `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/data/db.json`,
          {
            headers: {
              'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
              'Accept': 'application/vnd.github.v3+json'
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          const content = JSON.parse(atob(data.content));
          return new Response(JSON.stringify(content), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        } else {
          // Если файла нет, создаём пустую базу
          const emptyDb = {
            users: [],
            submissions: [],
            problems: [
              { id: 1, title: "A + B", difficulty: "easy", points: 100, testInput: "3 5", expectedOutput: "8", description: "Даны A и B. Выведите A+B." },
              { id: 2, title: "Четное или нечетное", difficulty: "easy", points: 100, testInput: "7", expectedOutput: "нечетное", description: "Определите, четное число или нет." },
              { id: 3, title: "Факториал", difficulty: "medium", points: 200, testInput: "5", expectedOutput: "120", description: "Вычислите n! (n ≤ 10)." },
              { id: 4, title: "Максимум трёх", difficulty: "medium", points: 200, testInput: "10 25 15", expectedOutput: "25", description: "Найдите наибольшее из трёх чисел." },
              { id: 5, title: "Сумма массива", difficulty: "hard", points: 300, testInput: "3\n1 2 3", expectedOutput: "6", description: "Найдите сумму элементов массива." }
            ]
          };
          return new Response(JSON.stringify(emptyDb), {
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
        
        // Получаем текущий файл чтобы получить SHA
        const fileResponse = await fetch(
          `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/data/db.json`,
          {
            headers: {
              'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
              'Accept': 'application/vnd.github.v3+json'
            }
          }
        );
        
        let sha = null;
        if (fileResponse.ok) {
          const fileData = await fileResponse.json();
          sha = fileData.sha;
        }
        
        // Подготавливаем запрос на обновление/создание
        const body = {
          message: 'Update database via Cloudflare Worker',
          content: btoa(JSON.stringify(newData, null, 2))
        };
        if (sha) body.sha = sha;
        
        const updateResponse = await fetch(
          `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/data/db.json`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
          }
        );
        
        if (updateResponse.ok) {
          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders }
          });
        } else {
          const errorData = await updateResponse.text();
          return new Response(JSON.stringify({ error: errorData }), {
            status: updateResponse.status,
            headers: { ...corsHeaders }
          });
        }
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders }
        });
      }
    }
    
    // Регистрация/авторизация пользователя
    if (path === '/api/auth/register' && request.method === 'POST') {
      const { username, avatar } = await request.json();
      
      // Получаем текущие данные
      const dataResponse = await fetch(`${url.origin}/api/data`, {
        headers: { 'Authorization': request.headers.get('Authorization') || '' }
      });
      const data = await dataResponse.json();
      
      // Проверяем, существует ли пользователь
      let user = data.users.find(u => u.username === username);
      if (!user) {
        user = {
          id: Date.now(),
          username: username,
          avatar: avatar || username.slice(0,2).toUpperCase(),
          points: 0,
          solved: [],
          rating: 1000,
          registeredAt: new Date().toISOString()
        };
        data.users.push(user);
        
        // Сохраняем обновлённые данные
        await fetch(`${url.origin}/api/data`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      }
      
      return new Response(JSON.stringify({ success: true, user: user }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    // Обновление пользователя (очки, решённые задачи)
    if (path === '/api/user/update' && request.method === 'POST') {
      const { username, points, solved, problemId } = await request.json();
      
      const dataResponse = await fetch(`${url.origin}/api/data`);
      const data = await dataResponse.json();
      
      const userIndex = data.users.findIndex(u => u.username === username);
      if (userIndex !== -1) {
        if (points !== undefined) data.users[userIndex].points = points;
        if (solved !== undefined) data.users[userIndex].solved = solved;
        if (problemId && !data.users[userIndex].solved.includes(problemId)) {
          data.users[userIndex].solved.push(problemId);
        }
        
        // Добавляем запись о решении
        if (problemId) {
          data.submissions.push({
            username: username,
            problemId: problemId,
            status: 'accepted',
            timestamp: new Date().toISOString()
          });
        }
        
        await fetch(`${url.origin}/api/data`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        
        return new Response(JSON.stringify({ success: true, user: data.users[userIndex] }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders }
      });
    }
    
    // Получить рейтинг
    if (path === '/api/leaderboard' && request.method === 'GET') {
      const dataResponse = await fetch(`${url.origin}/api/data`);
      const data = await dataResponse.json();
      
      const leaderboard = data.users
        .sort((a, b) => b.points - a.points)
        .map((u, i) => ({
          rank: i + 1,
          username: u.username,
          points: u.points,
          solved: u.solved.length,
          avatar: u.avatar
        }));
      
      return new Response(JSON.stringify(leaderboard), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    // Получить задачи
    if (path === '/api/problems' && request.method === 'GET') {
      const dataResponse = await fetch(`${url.origin}/api/data`);
      const data = await dataResponse.json();
      
      return new Response(JSON.stringify(data.problems || []), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    // Корневой эндпоинт
    return new Response('CodeBattles API v1.0 - Worker is running!', {
      headers: { ...corsHeaders }
    });
  }
}
