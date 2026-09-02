export const MACOS_TCC_KEY_OVERRIDES = {
  'auto.hooks.useMacosTccPromptNotice.description': {
    es: 'macOS atribuye a AIO-ADE el acceso a archivos realizado por tus agentes y herramientas de terminal. Conceder acceso total al disco reduce estos avisos.',
    ja: 'エージェントやターミナルツールがファイルにアクセスすると、macOS はそのアクセス元を AIO-ADE として扱います。フルディスクアクセスを許可すると、これらの確認を減らせます。',
    ko: '에이전트와 터미널 도구의 파일 접근은 macOS에서 AIO-ADE의 접근으로 표시됩니다. 전체 디스크 접근 권한을 허용하면 이러한 요청을 줄일 수 있습니다.',
    zh: 'macOS 会将代理和终端工具的文件访问归因于 AIO-ADE。授予“完全磁盘访问权限”可减少此类提示。'
  },
  'auto.components.settings.DeveloperPermissionsPane.7ca17b62c8': {
    es: 'Cuando los agentes que ejecuta AIO-ADE leen datos de otras apps, macOS muestra el nombre de AIO-ADE porque es el proceso responsable de los comandos de terminal. Concede este permiso a AIO-ADE y AIO-ADE Helper para reducir esos avisos. Después, cierra AIO-ADE, finaliza cualquier proceso de AIO-ADE Helper que siga en ejecución y vuelve a abrir AIO-ADE.',
    ja: 'AIO-ADE が実行するエージェントがほかのアプリのデータを読み取ると、ターミナルコマンドの実行元プロセスである AIO-ADE の名前が macOS に表示されます。これらの確認を減らすには、AIO-ADE と AIO-ADE Helper にこの権限を許可してください。その後、AIO-ADE を終了し、残っている AIO-ADE Helper プロセスもすべて終了してから、AIO-ADE を再度開いてください。',
    ko: 'AIO-ADE가 실행하는 에이전트가 다른 앱의 데이터를 읽으면, macOS는 터미널 명령을 실행하는 프로세스인 AIO-ADE를 표시합니다. 이러한 요청을 줄이려면 AIO-ADE와 AIO-ADE Helper에 이 권한을 허용하세요. 그런 다음 AIO-ADE를 종료하고, 남아 있는 AIO-ADE Helper 프로세스도 모두 종료한 후 AIO-ADE를 다시 여세요.',
    zh: '当 AIO-ADE 运行的代理读取其他应用的数据时，macOS 会显示 AIO-ADE，因为 AIO-ADE 是执行终端命令的进程。请为 AIO-ADE 和 AIO-ADE Helper 授予此权限，以减少此类提示。然后退出 AIO-ADE，结束所有仍在运行的 AIO-ADE Helper 进程，再重新打开 AIO-ADE。'
  },
  'auto.components.settings.DeveloperPermissionsPane.c566bca278': {
    ko: '전체 디스크 접근 권한',
    zh: '完全磁盘访问权限'
  }
}
