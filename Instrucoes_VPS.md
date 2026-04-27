# Guia de Deploy no VPS (Docker + Nginx)

Este guia cobre como subir a aplicação no seu VPS utilizando Docker e como configurar o domínio `nfe.virgulacontabil.com.br`.

## 1. Preparando o Ambiente no VPS

Certifique-se de que seu servidor possua **Docker** e **Docker Compose** instalados.
Acesse seu VPS via SSH:

```bash
# Clone ou copie os arquivos do projeto para o VPS (por exemplo, na pasta /var/www/nfe-automator)
mkdir -p /var/www/nfe-automator
cd /var/www/nfe-automator
# Faça o upload dos arquivos (Dockerfile, docker-compose.yml, package.json, etc.) para esta pasta
```

## 2. Iniciar a Aplicação com Docker

Na pasta do projeto, execute:

```bash
docker-compose up -d --build
```

O Docker criará:
- Um volume em `./data/notas.db` para o banco de dados não ser perdido entre reinicializações.
- Um volume em `./uploads/` para os XMLs recebidos.
- Exporá a aplicação na porta `3000` do VPS internamente.

Para ver os logs e acompanhar se iniciou com sucesso:
```bash
docker-compose logs -f
```

*(Se quiser trocar o token de segurança para os robôs, edite o var de ambiente `AGENT_TOKEN` dentro de `docker-compose.yml` e reinicie)*

---

## 3. Configurar o Domínio no Nginx (Reverse Proxy)

Para tornar sua aplicação acessível por `http(s)://nfe.virgulacontabil.com.br`, instale o Nginx:

```bash
sudo apt update
sudo apt install nginx -y
```

Crie um arquivo de configuração para o seu domínio:

```bash
sudo nano /etc/nginx/sites-available/nfe.virgulacontabil.com.br
```

Cole o seguinte conteúdo:

```nginx
server {
    listen 80;
    server_name nfe.virgulacontabil.com.br;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Permitir upload de arquivos grandes se necessário:
        client_max_body_size 50M;
    }
}
```

Ative a configuração e reinicie o Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/nfe.virgulacontabil.com.br /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 4. Gerar o Certificado SSL (HTTPS Seguros)

Para configurar HTTPS automaticamente (gratuitamente), use o Certbot / Let's Encrypt:

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d nfe.virgulacontabil.com.br
```

Siga as instruções na tela e o HTTPS estará habilitado :)

---

## 5. Ajustar o Agent Local:
Agora que tudo está rodando, edite o código do seu Agente Local Python (`agente_local/agente_nfe.py`) e modifique a variável URL para o seu domínio final que acabou de ser ativado:

```python
API_URL = "https://nfe.virgulacontabil.com.br/api/upload"
```

A partir desse momento, as notas extraídas magicamente chegarão no seu portal online!
