using System;
using System.Security.Cryptography;
using System.Text;

namespace RestaurantApi.Models
{
    public static class SecurityUtils
    {
        private const string Salt = "RestaurantProSecureSaltValue2026!";

        public static string HashPassword(string password)
        {
            using var sha = SHA256.Create();
            var saltedPassword = password + Salt;
            var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(saltedPassword));
            return Convert.ToHexString(bytes).ToLower();
        }

        public static bool VerifyPassword(string password, string hash)
        {
            return HashPassword(password).Equals(hash, StringComparison.OrdinalIgnoreCase);
        }
    }
}
