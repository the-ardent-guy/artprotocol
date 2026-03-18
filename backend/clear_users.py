import sqlite3

conn = sqlite3.connect('artprotocol.db')
cursor = conn.cursor()

cursor.execute('DELETE FROM credit_transactions')
cursor.execute('DELETE FROM user_jobs')
cursor.execute('DELETE FROM users')

conn.commit()

cursor.execute('SELECT COUNT(*) FROM users')
print('Users remaining:', cursor.fetchone()[0])
cursor.execute('SELECT COUNT(*) FROM credit_transactions')
print('Transactions remaining:', cursor.fetchone()[0])
cursor.execute('SELECT COUNT(*) FROM user_jobs')
print('Jobs remaining:', cursor.fetchone()[0])

conn.close()
print('Done.')
