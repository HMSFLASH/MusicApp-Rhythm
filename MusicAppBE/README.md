# MusicApp backend

Runtime uses MySQL and Flyway. Create a local `.env` from [`.env.example`](.env.example), then run the application with `mvnw.cmd spring-boot:run`.

The target used for this project is `jdbc:mysql://localhost:3306/MusicApp` with user `root`. Do not commit `.env` files or database files.

## One-time SQLite import

The legacy SQLite data was imported with the test-scope importer. It protects existing MySQL data by aborting when an application table is non-empty.

```powershell
$env:MYSQL_URL='jdbc:mysql://127.0.0.1:3306/MusicApp?createDatabaseIfNotExist=true&useUnicode=true&characterEncoding=utf8&serverTimezone=UTC'
$env:MYSQL_USER='root'
$env:MYSQL_PASSWORD='admin'
.\mvnw.cmd test-compile exec:java '-Dexec.mainClass=com.music.app.tools.SqliteToMySqlMigration' '-Dexec.classpathScope=test' '-Dexec.args=musicapp.db'
```
