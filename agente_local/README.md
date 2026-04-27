# Agente Local - NFe Automator

Este agente local em Python é responsável por monitorar as pastas de XMLs (NF-e/NFC-e), extrair os dados e enviá-los de volta para o seu servidor VPS via API segura. Ele funciona como um serviço "background" para Windows.

## Instalação

1. Instale o Python (versão 3.8+ recomendada) no computador Windows do cliente. Lembre-se de assinalar a opção "Add Python to PATH" durante a instalação.
2. Abra o terminal (CMD ou PowerShell) na pasta onde extraiu este arquivo e rode:
   \`\`\`bash
   pip install -r requirements.txt
   \`\`\`

## Configuração

Abra o arquivo \`agente_nfe.py\` no Bloco de Notas ou qualquer editor e altere a seguinte seção do topo de acordo com a máquina cliente e seu servidor VPS:

\`\`\`python
API_URL = "http://SEU_IP_NO_VPS/api/upload" 
API_TOKEN = "chave-secreta-vps-123"
PASTA_MONITORADA = r"C:\\Caminho\\Para\\Sua\\Pasta\\De\\Arquivos"
\`\`\`

## Gerar Executável para Windows (.exe)

Para que o cliente não precise instalar o Python, você pode compilar o agente num \`.exe\` standalone.

1. No terminal do seu ambiente de desenvolvimento Windows, instale o \`pyinstaller\`:
   \`\`\`bash
   pip install pyinstaller
   \`\`\`
2. Crie o executável com a janela invisível (segundo plano):
   \`\`\`bash
   pyinstaller --onefile --noconsole agente_nfe.py
   \`\`\`
3. O executável estará na pasta \`dist/agente_nfe.exe\`. Você só precisa entregar este arquivo para o cliente. 
4. Para inicializar junto com o Windows, crie um atalho do \`.exe\` criado e cole na pasta de inicialização do Windows do cliente (Pressione \`Win + R\`, digite \`shell:startup\` e aperte Enter).
