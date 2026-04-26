export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    
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
      return new Response(JSON.stringify({ error: "File not found" }), {
        status: 404,
        headers: { ...corsHeaders }
      });
    }
    
    // Сохранить данные в GitHub
    if (path === '/api/data' && request.method === 'POST') {
      const newData = await request.json();
      
      const fileResponse = await fetch(
        `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/data/db.json`,
        {
          headers: {
            'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );
      
      if (!fileResponse.ok) {
        return new Response(JSON.stringify({ error: "Cannot read file" }), {
          status: 500,
          headers: { ...corsHeaders }
        });
      }
      
      const fileData = await fileResponse.json();
      const sha = fileData.sha;
      
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
          headers: { ...corsHeaders }
        });
      }
    }
    
    return new Response('CodeBattles API is running', { headers: corsHeaders });
  }
}
