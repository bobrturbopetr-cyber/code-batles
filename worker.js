// Cloudflare Worker для CodeBattles
// Хранит данные в GitHub-репозитории через GitHub API

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // CORS заголовки
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Получить данные из GitHub
    if (path === '/api/data' && request.method === 'GET') {
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
      }
      return new Response(JSON.stringify({ users: [], submissions: [], problems: [] }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    // Сохранить данные в GitHub
    if (path === '/api/data' && request.method === 'POST') {
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
      
      const fileData = await fileResponse.json();
      const sha = fileData.sha;
      
      // Обновляем файл
      const updateResponse = await fetch(
        `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/data/db.json`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: 'Update database via Cloudflare Worker',
            content: btoa(JSON.stringify(newData, null, 2)),
            sha: sha
          })
        }
      );
      
      if (updateResponse.ok) {
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }
    
    // GitHub OAuth логин
    if (path === '/api/auth/github' && request.method === 'GET') {
      const clientId = env.GITHUB_CLIENT_ID;
      const redirectUri = `${url.origin}/api/auth/callback`;
      const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=read:user`;
      return Response.redirect(authUrl);
    }
    
    // OAuth callback
    if (path === '/api/auth/callback' && request.method === 'GET') {
      const code = url.searchParams.get('code');
      const clientId = env.GITHUB_CLIENT_ID;
      const clientSecret = env.GITHUB_CLIENT_SECRET;
      
      // Получаем токен
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code })
      });
      const tokenData = await tokenResponse.json();
      
      // Получаем данные пользователя
      const userResponse = await fetch('https://api.github.com/user', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
      });
      const userData = await userResponse.json();
      
      // Возвращаем информацию на фронтенд
      return new Response(`
        <script>
          window.opener.postMessage({
            type: 'github-login',
            user: {
              id: ${userData.id},
              username: '${userData.login}',
              avatar: '${userData.avatar_url}',
              name: '${userData.name || userData.login}'
            }
          }, '*');
          window.close();
        </script>
      `, { headers: { 'Content-Type': 'text/html' } });
    }
    
    return new Response('API работает', { headers: corsHeaders });
  }
}
