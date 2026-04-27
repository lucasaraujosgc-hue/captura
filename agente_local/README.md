# Agente Local - NFe Automator

Este agente local em Python é responsável por monitorar MÚLTIPLAS pastas de XMLs (NF-e/NFC-e), extrair os dados e enviá-los de volta para o seu servidor VPS via API segura. Ele funciona como um serviço "background" para Windows.

## Instalação

1. Instale o Python (versão 3.8+ recomendada) no computador Windows do cliente. Lembre-se de assinalar a opção "Add Python to PATH" durante a instalação.
2. Abra o terminal (CMD ou PowerShell) na pasta onde extraiu este arquivo e rode:
   ```bash
   pip install -r requirements.txt
   ```

## Configuração Visual (Interface Gráfica)

O agente possui uma interface gráfica (usando `tkinter` nativo do Python) que será aberta **automaticamente** na primeira vez que você rodar o programa, se não encontrar o arquivo `config.json`.

Nesta tela, você poderá:
1. Preencher a **URL do Servidor API** (ex: `https://nfe.virgulacontabil.com.br/api/upload`).
2. Colar o **Token da Empresa** (você deve gerar este token no Portal Web, cadastrando a nova empresa).
3. Adicionar **quantas pastas desejar**, informando se aquela pasta recebe notas de:
   - Entrada / Saída
   - Cancelada / Inutilizada
   - Modelo (55 NFe / 65 NFCe)

Ao final, será gerado automaticamente o arquivo `config.json` e o agente continuará monitorando em segundo plano.

## Gerar Executável para Windows (.exe)

Para que o cliente não precise instalar o Python, você pode compilar o agente num `.exe` standalone com tela de instalação/configuração embutida.

1. No terminal do seu ambiente de desenvolvimento Windows, instale o `pyinstaller`:
   ```bash
   pip install pyinstaller
   ```
2. Crie o executável. Para exibir a janela de configuração, usamos `--noconsole` para esconder a tela preta, mas a interface do tkinter ainda vai aparecer:
   ```bash
   pyinstaller --onefile --noconsole agente_nfe.py
   ```
3. O executável estará na pasta `dist/agente_nfe.exe`. Você só precisa entregar este arquivo para o cliente. Quando o cliente rodar a primeira vez, a tela de configuração vai aparecer.
4. Para inicializar junto com o Windows, crie um atalho do `.exe` criado e cole na pasta de inicialização do Windows do cliente (Pressione `Win + R`, digite `shell:startup` e aperte Enter).
