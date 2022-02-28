# 注意事項
## はじめに
本ドキュメントは、ワークフローシステムWHEELの仕様上の制限について説明いたします。  
以下の内容によって構成されています。  
1. [リモートタスクがシグナルによって終了した場合](#リモートタスクがシグナルによって終了した場合)
1. [プロジェクトを停止した場合における実行中スクリプトの取り扱い](#プロジェクトを停止した場合における実行中スクリプトの取り扱い)
1. [巨大なファイルの取り扱いについて](#巨大なファイルの取り扱いについて)
1. [input/outputコネクタを接続した状態でのコネクタ名称の変更について](#input/outputコネクタを接続した状態でのコネクタ名称の変更について)
1. [Windows環境での操作](#Windows環境での操作)
1. [holdingおよびunknown状態について](#holdingおよびunknown状態について)
1. [既存プロジェクトの読み込みについて](#既存プロジェクトの読み込みについて)

***
## リモートタスクがシグナルによって終了した場合
リモートホストで実行中のプロセスがシグナルによって終了した場合、  
WHEELの仕様上、リモートのシグナル番号を補足できないため正常終了と判断されます。  
***
## プロジェクトを停止した場合における実行中スクリプトの取り扱い
プロジェクトの停止ボタンによってプロジェクトを停止した場合、nodeが呼び出した子プロセスは停止されますが、
子プロセスが実行するスクリプトは停止されません。
***
## 巨大なファイルの取り扱いについて
WHEELではプロジェクトで取り扱うデータをgitで管理しているため大サイズのファイルをプロジェクトディレクトリ内に配置すると
リポジトリ操作のパフォーマンスが低下することによって様々なトラブルが起きます。
この問題を回避するためWHEELのグラフビューからアップロードしたファイルについては一定以上のサイズのものは
git LFS (https://git-lfs.github.com/) による管理の対象とするように設定します。
WHEEL以外の手段でプロジェクトのgitリポジトリにファイルを追加した場合は、サイズによっては正常に操作できなくなる可能性があるので注意してください。
***
## input/outputコネクタを接続した状態でのコネクタ名称の変更について
複数のoutputコネクタを1つのinputコネクタに接続してる状態で、  
inputコネクタの名称変更を行なうと、同時に複数の名称変更処理が行われるため  
コンポーネントの整合性が取れなくなる場合があります。  
input/outputコネクタの編集を行う際は、接続を解除してから実施してください。
***
## Windows環境での操作
WHEELの動作環境がWindowsOSの際、プロジェクトのdeleteを実行するとエラーが表示される場合があります。  
その場合、deleteしたプロジェクトはプロジェクトリストから削除されますが、実データは削除されません。手動にて削除してください。
***
## holdingおよびunknown状態について
プロジェクトにジョブを投入するタスクが含まれていると、プロジェクトの状態がholdingまたはunknown状態となることがあります。
holding状態は、ジョブの投入後終了を確認する前に、WHEELのプロセスが終了してしまった時に遷移します。
この状態では、プロジェクトの実行は一時停止していますがプロセスが終了する前に投入したジョブの終了確認のみを行なっています。
全てのジョブが終了した段階で、unknown状態に遷移します。

unknown状態は、プロジェクトの状態が確認できない状態を意味します。
前述のholding状態から遷移してきた場合は、個々のコンポーネントの状態を確認して全てのタスクが完了しているかどうかを確認してください。
終了していないタスクが存在する時は、そのままプロジェクトを再実行すると未実行およびfailed状態のコンポーネントのみが再実行されます。

また、ジョブを投入した後の状態確認処理に失敗した場合(e.g. 一時的な障害などでバッチサーバへの接続が行なえなかった時など)にもunknown状態になります。
この場合は、unknown状態となったタスクが正常に終了しているかどうかを直接ジョブ投入先サーバへログインするなどして確認し、
必要なファイルがあればコピーしてきてください。
***
## 既存プロジェクトの読み込みについて
WHEELは、プロジェクトリストに載っていない既存のプロジェクトを読み込む際に、全ての変更をgitリポジトリにコミットします。このため、読み込むプロジェクトまたはプロジェクトに含まれるコンポーネントが"not-started"以外の状態だった場合、プロジェクトのcleanを行なっても再実行できなくなります。
したがって、読み込み前にプロジェクトおよびコンポーネントのstateを確認してから実行してください。
