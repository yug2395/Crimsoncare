import oracledb
oracledb.init_oracle_client()
# Replace with your Oracle XE credentials
username = "crimsoncare"
password = "crimson123"
dsn = "localhost/XE"  # 'XE' is the default service name for Oracle 11g XE

def get_connection():
    connection = oracledb.connect(user=username, password=password, dsn=dsn)
    return connection
