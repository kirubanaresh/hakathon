import bcrypt

def hash_password(password: str) -> str:
    # Hash a password for storing
    # In a real app, you'd use os.urandom(bcrypt.gensalt())
    # For consistency with your mock_users_db if fake_hash_password is simple:
    # return password + "notreallyhashed" # IF fake_hash_password is just appending
    # Else, for proper bcrypt:
    password_bytes = password.encode('utf-8')
    hashed_bytes = bcrypt.hashpw(password_bytes, bcrypt.gensalt())
    return hashed_bytes.decode('utf-8')

if __name__ == "__main__":
    password = input("Enter password to hash: ")
    hashed = hash_password(password)
    print(f"Hashed Password: {hashed}")