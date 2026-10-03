import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Lang = "ru" | "en";

const translations = {
  // Navigation
  "nav.tasks": { ru: "Задачи", en: "Tasks" },
  "settings.boards": { ru: "Доски задач", en: "Task boards" },
  "settings.boardsDesc": { ru: "Добавляйте, переименовывайте и сортируйте доски", en: "Add, rename and reorder boards" },
  "nav.motion": { ru: "Моушен", en: "Motion" },
  "nav.sites": { ru: "Сайты", en: "Sites" },
  "nav.cs2": { ru: "CS2 Bot", en: "CS2 Bot" },
  "nav.users": { ru: "Пользователи", en: "Users" },
  "nav.settings": { ru: "Настройки", en: "Settings" },
  "task.board": { ru: "Доска", en: "Board" },
  "task.boardMotion": { ru: "Моушен", en: "Motion" },
  "task.boardSites": { ru: "Сайты", en: "Sites" },
  "task.boardCs2": { ru: "CS2 Bot", en: "CS2 Bot" },

  // Auth
  "auth.welcome": { ru: "Добро пожаловать", en: "Welcome" },
  "auth.createAccount": { ru: "Создать аккаунт", en: "Create Account" },
  "auth.loginTo": { ru: "Войдите в Neura Team", en: "Sign in to Neura Team" },
  "auth.startWith": { ru: "Начните работу с Neura Team", en: "Get started with Neura Team" },
  "auth.name": { ru: "Имя", en: "Name" },
  "auth.yourName": { ru: "Ваше имя", en: "Your name" },
  "auth.email": { ru: "Email", en: "Email" },
  "auth.password": { ru: "Пароль", en: "Password" },
  "auth.loading": { ru: "Загрузка...", en: "Loading..." },
  "auth.login": { ru: "Войти", en: "Sign In" },
  "auth.noAccount": { ru: "Нет аккаунта? Зарегистрироваться", en: "No account? Sign up" },
  "auth.hasAccount": { ru: "Уже есть аккаунт? Войти", en: "Already have an account? Sign in" },
  "auth.forgotPassword": { ru: "Забыли пароль?", en: "Forgot password?" },
  "auth.forgotTitle": { ru: "Забыли пароль?", en: "Forgot password?" },
  "auth.forgotDesc": { ru: "Введите email для сброса пароля", en: "Enter your email to reset password" },
  "auth.sendLink": { ru: "Отправить ссылку", en: "Send link" },
  "auth.sending": { ru: "Отправка...", en: "Sending..." },
  "auth.backToLogin": { ru: "Вернуться к входу", en: "Back to login" },
  "auth.loginError": { ru: "Ошибка входа", en: "Login error" },
  "auth.signupError": { ru: "Ошибка регистрации", en: "Registration error" },
  "auth.accountCreated": { ru: "Аккаунт создан", en: "Account created" },
  "auth.checkEmail": { ru: "Проверьте почту для подтверждения.", en: "Check your email for confirmation." },
  "auth.resetSent": { ru: "Письмо для сброса пароля отправлено на ", en: "Password reset email sent to " },

  // Reset Password
  "reset.title": { ru: "Сброс пароля", en: "Reset Password" },
  "reset.desc": { ru: "Введите новый пароль", en: "Enter a new password" },
  "reset.newPassword": { ru: "Новый пароль", en: "New password" },
  "reset.confirmPassword": { ru: "Подтвердите пароль", en: "Confirm password" },
  "reset.minChars": { ru: "Минимум 6 символов", en: "Minimum 6 characters" },
  "reset.repeatPassword": { ru: "Повторите пароль", en: "Repeat password" },
  "reset.saving": { ru: "Сохранение...", en: "Saving..." },
  "reset.changePassword": { ru: "Сменить пароль", en: "Change password" },
  "reset.loading": { ru: "Загрузка... Если страница не загрузилась, перейдите по ссылке из письма заново.", en: "Loading... If the page didn't load, follow the link from the email again." },
  "reset.minError": { ru: "Пароль должен быть минимум 6 символов", en: "Password must be at least 6 characters" },
  "reset.mismatch": { ru: "Пароли не совпадают", en: "Passwords don't match" },
  "reset.success": { ru: "Пароль успешно изменён!", en: "Password changed successfully!" },

  // Admin Dashboard
  "admin.tasks": { ru: "Задачи", en: "Tasks" },
  "admin.totalAcross": { ru: "всего у", en: "total across" },
  "admin.users": { ru: "пользователей", en: "users" },
  "admin.searchTasks": { ru: "Поиск задач...", en: "Search tasks..." },
  "admin.allUsers": { ru: "Все пользователи", en: "All users" },
  "admin.archive": { ru: "Архив", en: "Archive" },
  "admin.archiveDesc": { ru: "Задачи созданные более 14 дней назад", en: "Tasks created more than 14 days ago" },
  "admin.noArchived": { ru: "Нет архивных задач", en: "No archived tasks" },
  "admin.archiveLoading": { ru: "Загружаем архив...", en: "Loading archive..." },

  // User Dashboard
  "user.myTasks": { ru: "Мои задачи", en: "My Tasks" },
  "user.tasksAssigned": { ru: "задач назначено вам", en: "tasks assigned to you" },

  // Create Task
  "task.create": { ru: "Создать задачу", en: "Create Task" },
  "task.new": { ru: "Новая задача", en: "New Task" },
  "task.code": { ru: "Код задачи", en: "Task Code" },
  "task.title": { ru: "Название", en: "Title" },
  "task.titlePlaceholder": { ru: "Название задачи", en: "Task title" },
  "task.description": { ru: "Описание", en: "Description" },
  "task.descOptional": { ru: "Описание (необязательно)", en: "Description (optional)" },
  "task.deleteConfirm": { ru: "Удалить задачу?", en: "Delete task?" },
  "task.deleteDesc": { ru: "Эта задача и все её комментарии и файлы будут удалены. Это действие необратимо.", en: "This task and all its comments and files will be deleted. This action is irreversible." },
  "task.deleted": { ru: "Задача удалена", en: "Task deleted" },
  "task.deleteError": { ru: "Ошибка удаления задачи", en: "Error deleting task" },
  "task.priority": { ru: "Приоритет", en: "Priority" },
  "task.low": { ru: "Низкий", en: "Low" },
  "task.medium": { ru: "Средний", en: "Medium" },
  "task.high": { ru: "Высокий", en: "High" },
  "task.urgent": { ru: "Срочный", en: "Urgent" },
  "task.direction": { ru: "Направление", en: "Direction" },
  "task.selectDirection": { ru: "Выберите направление", en: "Select direction" },
  "task.assign": { ru: "Назначить", en: "Assign" },
  "task.reassign": { ru: "Переназначить", en: "Reassign" },
  "task.selectUser": { ru: "Выберите пользователя", en: "Select user" },
  "task.attachFile": { ru: "Прикрепить файл", en: "Attach file" },
  "task.selectFile": { ru: "Выбрать файл", en: "Choose file" },
  "task.creating": { ru: "Создание...", en: "Creating..." },
  "task.created": { ru: "Задача создана", en: "Task created" },
  "task.createError": { ru: "Ошибка создания задачи", en: "Error creating task" },
  "task.duplicateCodeError": { ru: "Задача с кодом {code} уже существует", en: "A task with code {code} already exists" },

  // Task Detail
  "detail.assigned": { ru: "Назначен", en: "Assigned" },
  "detail.created": { ru: "Создана", en: "Created" },
  "detail.updated": { ru: "Обновлена", en: "Updated" },
  "detail.files": { ru: "Файлы", en: "Files" },
  "detail.attach": { ru: "Прикрепить", en: "Attach" },
  "detail.uploading": { ru: "Загрузка...", en: "Uploading..." },
  "detail.comments": { ru: "Комментарии", en: "Comments" },
  "detail.noComments": { ru: "Нет комментариев", en: "No comments" },
  "detail.writeComment": { ru: "Написать комментарий...", en: "Write a comment..." },
  "detail.you": { ru: "Вы", en: "You" },
  "detail.sendError": { ru: "Ошибка отправки", en: "Send error" },
  "detail.uploadError": { ru: "Ошибка загрузки", en: "Upload error" },
  "detail.saveError": { ru: "Ошибка сохранения", en: "Save error" },
  "detail.fileUploaded": { ru: "Файл загружен", en: "File uploaded" },
  "detail.completionTime": { ru: "Время выполнения", en: "Completion time" },
  "detail.edit": { ru: "Редактировать", en: "Edit" },
  "detail.editing": { ru: "Редактирование", en: "Editing" },
  "detail.saveChanges": { ru: "Сохранить изменения", en: "Save changes" },
  "detail.cancelEdit": { ru: "Отменить", en: "Cancel" },
  "detail.deleteTask": { ru: "Удалить задачу", en: "Delete task" },
  "detail.taskUpdated": { ru: "Задача обновлена", en: "Task updated" },
  "detail.updateError": { ru: "Ошибка обновления", en: "Update error" },
  "detail.deleteError": { ru: "Ошибка удаления", en: "Delete error" },
  "detail.fileDeleted": { ru: "Файл удалён", en: "File deleted" },
  "detail.deleteFileConfirm": { ru: "Вы точно хотите удалить?", en: "Are you sure you want to delete?" },
  "detail.deleteFileDesc": { ru: "Прикреплённый файл будет удалён без возможности восстановления.", en: "The attached file will be permanently deleted." },
  "detail.confirm": { ru: "Подтвердить", en: "Confirm" },
  "detail.deleteComment": { ru: "Удалить комментарий", en: "Delete comment" },
  "detail.submissions": { ru: "Сдача работы", en: "Submissions" },
  "detail.dragVideos": { ru: "Перетащите видео сюда или", en: "Drag videos here or" },
  "detail.selectVideos": { ru: "выберите файлы", en: "select files" },
  "detail.uploadingVideos": { ru: "Загрузка видео...", en: "Uploading videos..." },
  "detail.videosUploaded": { ru: "Видео загружены", en: "Videos uploaded" },
  "detail.downloadAll": { ru: "Скачать всё", en: "Download all" },
  "detail.preparingZip": { ru: "Подготовка архива...", en: "Preparing archive..." },
  "detail.runSeparately": { ru: "Run separately", en: "Run separately" },
  "detail.downloadingSeparately": { ru: "Скачивание...", en: "Downloading..." },
  "detail.expiresIn": { ru: "Удалится через", en: "Expires in" },
  "detail.days": { ru: "д", en: "d" },

  // Users Page
  "users.title": { ru: "Пользователи", en: "Users" },
  "users.members": { ru: "участников", en: "members" },
  "users.add": { ru: "Добавить", en: "Add" },
  "users.createUser": { ru: "Создать пользователя", en: "Create User" },
  "users.create": { ru: "Создать", en: "Create" },
  "users.createError": { ru: "Ошибка создания", en: "Creation error" },
  "users.userCreated": { ru: "Пользователь создан", en: "User created" },
  "users.changePassword": { ru: "Сменить пароль", en: "Change password" },
  "users.changeEmail": { ru: "Сменить email", en: "Change email" },
  "users.newPassword": { ru: "Новый пароль", en: "New password" },
  "users.newEmail": { ru: "Новый email", en: "New email" },
  "users.save": { ru: "Сохранить", en: "Save" },
  "users.saving": { ru: "Сохранение...", en: "Saving..." },
  "users.passwordChanged": { ru: "Пароль изменён", en: "Password changed" },
  "users.emailChanged": { ru: "Email изменён", en: "Email changed" },
  "users.changeName": { ru: "Сменить имя", en: "Change name" },
  "users.newName": { ru: "Новое имя", en: "New name" },
  "users.nameChanged": { ru: "Имя изменено", en: "Name changed" },
  "users.blocked": { ru: "Заблокирован", en: "Blocked" },
  "users.userBlocked": { ru: "Пользователь заблокирован", en: "User blocked" },
  "users.userUnblocked": { ru: "Пользователь разблокирован", en: "User unblocked" },
  "users.tasks": { ru: "задач", en: "tasks" },
  "users.deleteUser": { ru: "Удалить пользователя?", en: "Delete user?" },
  "users.deleteDesc": { ru: "Вы уверены, что хотите удалить", en: "Are you sure you want to delete" },
  "users.deleteWarning": { ru: "? Все задачи, комментарии и файлы этого пользователя будут удалены. Это действие необратимо.", en: "? All tasks, comments and files of this user will be deleted. This action is irreversible." },
  "users.cancel": { ru: "Отмена", en: "Cancel" },
  "users.delete": { ru: "Удалить", en: "Delete" },
  "users.deleted": { ru: "Пользователь удалён", en: "User deleted" },
  "users.madeAdmin": { ru: "Пользователь назначен администратором", en: "User promoted to admin" },
  "users.madeUser": { ru: "Права администратора сняты", en: "Admin rights revoked" },
  "users.toggleAdmin": { ru: "Назначить/снять админа", en: "Toggle admin role" },
  "users.role": { ru: "Роль", en: "Role" },
  "users.roleAdmin": { ru: "Админ", en: "Admin" },
  "users.roleTeamlead": { ru: "Тимлид", en: "Team lead" },
  "users.roleUser": { ru: "Юзер", en: "User" },
  "users.roleChanged": { ru: "Роль изменена", en: "Role changed" },
  "users.changeRole": { ru: "Изменить роль", en: "Change role" },
  "users.manageTeam": { ru: "Управление командой", en: "Manage team" },
  "users.teamMembers": { ru: "Подчинённые", en: "Team members" },
  "users.teamMembersDesc": { ru: "Выберите пользователей, которыми будет руководить тимлид", en: "Select users this team lead will manage" },
  "users.teamSaved": { ru: "Команда обновлена", en: "Team updated" },
  "users.noMembers": { ru: "Нет подчинённых", en: "No subordinates" },
  "users.teamlead": { ru: "Тимлид", en: "Team lead" },

  // Settings
  "settings.title": { ru: "Настройки", en: "Settings" },
  "settings.companyLogo": { ru: "Логотип компании", en: "Company Logo" },
  "settings.logoDesc": { ru: "Загрузите логотип который будет отображаться на странице входа и в меню", en: "Upload a logo to display on the login page and menu" },
  "settings.changeLogo": { ru: "Сменить логотип", en: "Change logo" },
  "settings.uploadLogo": { ru: "Загрузить логотип", en: "Upload logo" },
  "settings.logoUpdated": { ru: "Логотип обновлён", en: "Logo updated" },
  "settings.avatar": { ru: "Аватар", en: "Avatar" },
  "settings.avatarDesc": { ru: "Загрузите фото профиля", en: "Upload a profile photo" },
  "settings.choosePhoto": { ru: "Выбрать фото", en: "Choose photo" },
  "settings.avatarUpdated": { ru: "Аватар обновлён", en: "Avatar updated" },
  "settings.passwordTitle": { ru: "Смена пароля", en: "Change Password" },
  "settings.passwordDesc": { ru: "Введите новый пароль для вашего аккаунта", en: "Enter a new password for your account" },
  "settings.passwordChanged": { ru: "Пароль успешно изменён", en: "Password changed successfully" },
  "settings.youAdmin": { ru: "Вы — администратор", en: "You are an admin" },
  "settings.adminDesc": { ru: "У вас есть полный доступ ко всем пользователям и задачам", en: "You have full access to all users and tasks" },
  "settings.activateAdmin": { ru: "Активация админ-доступа", en: "Activate Admin Access" },
  "settings.activateDesc": { ru: "Введите секретный код для получения прав администратора", en: "Enter the secret code to get admin rights" },
  "settings.adminCode": { ru: "Код администратора", en: "Admin code" },
  "settings.enterCode": { ru: "Введите код", en: "Enter code" },
  "settings.checking": { ru: "Проверка...", en: "Checking..." },
  "settings.activate": { ru: "Активировать", en: "Activate" },
  "settings.adminActivated": { ru: "Админ-доступ активирован!", en: "Admin access activated!" },
  "settings.uploadError": { ru: "Ошибка загрузки", en: "Upload error" },
  "settings.saveError": { ru: "Ошибка сохранения", en: "Save error" },
  "settings.profileError": { ru: "Ошибка обновления профиля", en: "Profile update error" },
  "settings.changeName": { ru: "Сменить имя", en: "Change Name" },
  "settings.nameDesc": { ru: "Измените отображаемое имя вашего профиля", en: "Change your display name" },
  "settings.name": { ru: "Имя", en: "Name" },
  "settings.nameUpdated": { ru: "Имя обновлено", en: "Name updated" },
  "settings.directionsTitle": { ru: "Направления задач", en: "Task Directions" },
  "settings.directionsDesc": { ru: "Управляйте списком направлений для задач", en: "Manage the list of task directions" },
  "settings.newDirection": { ru: "Новое направление...", en: "New direction..." },
  "settings.saveDirections": { ru: "Сохранить направления", en: "Save directions" },
  "settings.directionsSaved": { ru: "Направления сохранены", en: "Directions saved" },
  "settings.telegramTitle": { ru: "Telegram уведомления", en: "Telegram Notifications" },
  "settings.telegramDesc": { ru: "Укажите Chat ID для получения уведомлений когда задачи ставятся на проверку", en: "Enter Chat ID to receive notifications when tasks are sent to review" },
  "settings.telegramChatId": { ru: "Telegram Chat ID", en: "Telegram Chat ID" },
  "settings.telegramSaved": { ru: "Telegram Chat ID сохранён", en: "Telegram Chat ID saved" },
  "settings.telegramHint": { ru: "Напишите боту /start и используйте @userinfobot чтобы узнать свой Chat ID", en: "Write /start to the bot and use @userinfobot to find your Chat ID" },
  "settings.directionExists": { ru: "Такое направление уже есть", en: "This direction already exists" },
  "settings.directionMinOne": { ru: "Нужно хотя бы одно направление", en: "At least one direction is required" },

  "task.complexity": { ru: "Сложность", en: "Complexity" },
  "task.estimatedTime": { ru: "Ориент. время", en: "Est. time" },
  "task.hours": { ru: "ч", en: "h" },
  "task.minutes": { ru: "м", en: "m" },
  "detail.timerPaused": { ru: "Таймер на паузе", en: "Timer paused" },
  "detail.timerResumed": { ru: "Таймер возобновлён", en: "Timer resumed" },
  "detail.timer": { ru: "Таймер", en: "Timer" },
  "detail.pause": { ru: "Пауза", en: "Pause" },
  "detail.resume": { ru: "Возобновить", en: "Resume" },
  "detail.paused": { ru: "На паузе", en: "Paused" },
  "detail.elapsed": { ru: "Прошло", en: "Elapsed" },

  // Kanban
  "kanban.todo": { ru: "К выполнению", en: "To Do" },
  "kanban.inProgress": { ru: "В работе", en: "In Progress" },
  "kanban.review": { ru: "На проверке", en: "QA Review" },
  "kanban.corrections": { ru: "Вносятся правки", en: "Corrections" },
  "kanban.done": { ru: "Готово", en: "Done" },
  "kanban.onlyAdminDone": { ru: "Только администратор может завершать задачи", en: "Only an admin can complete tasks" },
  "kanban.dropHere": { ru: "Перетащите сюда", en: "Drop here" },

  // Stats
  "nav.stats": { ru: "Статистика", en: "Statistics" },
  "stats.title": { ru: "Статистика", en: "Statistics" },
  "stats.description": { ru: "Выполненные задачи по пользователям за период", en: "Completed tasks per user over a period" },
  "stats.today": { ru: "Сегодня", en: "Today" },
  "stats.3days": { ru: "3 дня", en: "3 days" },
  "stats.7days": { ru: "7 дней", en: "7 days" },
  "stats.30days": { ru: "30 дней", en: "30 days" },
  "stats.90days": { ru: "90 дней", en: "90 days" },
  "stats.custom": { ru: "Свой период", en: "Custom range" },
  "stats.total": { ru: "всего", en: "total" },
  "stats.noData": { ru: "Нет данных", en: "No data" },
  "stats.workload": { ru: "Загруженность", en: "Workload" },
  "stats.hours": { ru: "ч", en: "h" },
  "stats.of": { ru: "из", en: "of" },

  // 404
  "notFound.title": { ru: "Страница не найдена", en: "Page not found" },
  "notFound.back": { ru: "Вернуться на главную", en: "Return to Home" },

  // Language
  "lang.language": { ru: "Язык", en: "Language" },
  "lang.ru": { ru: "Русский", en: "Russian" },
  "lang.en": { ru: "English", en: "English" },

  // Chats
  "chats.title": { ru: "Личные чаты", en: "Direct chats" },
  "chats.search": { ru: "Поиск по имени или тегу...", en: "Search by name or tag..." },
  "chats.buyers": { ru: "Баеры", en: "Buyers" },
  "chats.designers": { ru: "Дизайнеры", en: "Designers" },
  "chats.noMatches": { ru: "Нет совпадений", en: "No matches" },
  "chats.designer": { ru: "Дизайнер", en: "Designer" },
  "chats.buyer": { ru: "Баер", en: "Buyer" },
  "chats.pickBoth": { ru: "Выберите баера и дизайнера, чтобы открыть их чат", en: "Select a buyer and a designer to open their chat" },
  "chats.pickBuyer": { ru: "Выберите баера, чтобы начать диалог", en: "Select a buyer to start a conversation" },
  "chats.pickDesigner": { ru: "Выберите дизайнера, чтобы начать диалог", en: "Select a designer to start a conversation" },
  "chats.noAccess": { ru: "У вас нет доступа к личным чатам", en: "You don't have access to direct chats" },
  "chat.empty": { ru: "Сообщений пока нет. Напишите первое.", en: "No messages yet. Write the first one." },
  "chat.emptyTask": { ru: "Сообщений пока нет.", en: "No messages yet." },
  "chat.askDetails": { ru: "Напишите, чтобы уточнить детали.", en: "Write a message to clarify details." },
  "chat.placeholder": { ru: "Напишите сообщение...", en: "Write a message..." },
  "chat.asBuyerPlaceholder": { ru: "От имени баера...", en: "As the buyer..." },
  "chat.sendAsSelf": { ru: "Отправить от своего имени (иначе — от имени баера)", en: "Send as myself (otherwise as the buyer)" },
  "chat.attachImage": { ru: "Прикрепить изображение", en: "Attach image" },
  "chat.imageRetention": { ru: "Изображения хранятся до 5 дней", en: "Images are stored for up to 5 days" },
  "chat.uploadFailed": { ru: "Загрузка не удалась: ", en: "Upload failed: " },
  "chat.writtenByAdmin": { ru: "написано админом", en: "written by admin" },
  "chat.taskChatTitle": { ru: "Личный чат", en: "Direct chat" },
  "nav.chats": { ru: "Чаты", en: "Chats" },

  // Guide book
  "nav.guides": { ru: "Гайд бук", en: "Guide book" },
  "guide.title": { ru: "Гайд бук", en: "Guide book" },
  "guide.new": { ru: "Новый гайд", en: "New guide" },
  "guide.search": { ru: "Поиск по гайдам...", en: "Search guides..." },
  "guide.noGuides": { ru: "Пока нет гайдов", en: "No guides yet" },
  "guide.notFound": { ru: "Гайд не найден", en: "Guide not found" },
  "guide.back": { ru: "К списку", en: "Back" },
  "guide.edit": { ru: "Редактировать", en: "Edit" },
  "guide.save": { ru: "Сохранить", en: "Save" },
  "guide.deleteConfirm": { ru: "Удалить гайд?", en: "Delete this guide?" },
  "guide.titleLabel": { ru: "Заголовок", en: "Title" },
  "guide.category": { ru: "Категория", en: "Category" },
  "guide.categoryPlaceholder": { ru: "Например: Моушен", en: "e.g. Motion" },
  "guide.summary": { ru: "Краткое описание", en: "Summary" },
  "guide.content": { ru: "Содержание", en: "Content" },
  "guide.files": { ru: "Материалы и видео", en: "Files & videos" },
  "guide.noFiles": { ru: "Файлов пока нет", en: "No files yet" },
  "guide.upload": { ru: "Загрузить", en: "Upload" },
  "guide.noContent": { ru: "Нет содержания", en: "No content" },
  "guide.tabGuides": { ru: "Гайды", en: "Guides" },
  "guide.tabVoices": { ru: "Голоса", en: "Voices" },
  "guide.newVoice": { ru: "Новый голос", en: "New voice" },
  "guide.searchVoices": { ru: "Поиск по голосам...", en: "Search voices..." },
  "guide.noVoices": { ru: "Пока нет голосов", en: "No voices yet" },
  "guide.download": { ru: "Скачать", en: "Download" },

  // Copy
  "common.copy": { ru: "Копировать", en: "Copy" },
  "common.copied": { ru: "Скопировано", en: "Copied" },
  "common.copyFailed": { ru: "Не удалось скопировать", en: "Failed to copy" },
} as const;

type TranslationKey = keyof typeof translations;

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem("app-lang");
    return (saved === "en" || saved === "ru") ? saved : "ru";
  });

  const setLang = (newLang: Lang) => {
    setLangState(newLang);
    localStorage.setItem("app-lang", newLang);
  };

  const t = (key: TranslationKey): string => {
    return translations[key]?.[lang] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
