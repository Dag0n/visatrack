// Command applesecret generates the ES256 JWT that Apple's "Sign in with
// Apple" expects as the OAuth2 client secret. Apple doesn't issue a static
// secret like other providers — it must be (re)generated from your .p8 key,
// and expires after at most 6 months, so this needs re-running periodically.
package main

import (
	"crypto/ecdsa"
	"crypto/x509"
	"encoding/pem"
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func main() {
	keyPath := flag.String("key", "", "path to the .p8 private key file")
	teamID := flag.String("team", "", "Apple Team ID")
	keyID := flag.String("kid", "", "Apple Key ID (matches the AuthKey_<kid>.p8 filename)")
	clientID := flag.String("client", "", "Services ID registered for Sign in with Apple")
	flag.Parse()

	if *keyPath == "" || *teamID == "" || *keyID == "" || *clientID == "" {
		log.Fatal("usage: applesecret -key AuthKey_XXXX.p8 -team TEAMID -kid KEYID -client your.services.id")
	}

	raw, err := os.ReadFile(*keyPath)
	if err != nil {
		log.Fatal(err)
	}

	block, _ := pem.Decode(raw)
	if block == nil {
		log.Fatal("failed to decode PEM block from key file")
	}

	parsedKey, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		log.Fatal(err)
	}

	ecKey, ok := parsedKey.(*ecdsa.PrivateKey)
	if !ok {
		log.Fatal("key is not an ECDSA private key")
	}

	now := time.Now()
	claims := jwt.MapClaims{
		"iss": *teamID,
		"iat": now.Unix(),
		"exp": now.AddDate(0, 6, 0).Unix(), // Apple's max allowed lifetime
		"aud": "https://appleid.apple.com",
		"sub": *clientID,
	}

	token := jwt.NewWithClaims(jwt.SigningMethodES256, claims)
	token.Header["kid"] = *keyID

	signed, err := token.SignedString(ecKey)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println(signed)
	fmt.Fprintf(os.Stderr, "\nExpires: %s (re-run this before then)\n", now.AddDate(0, 6, 0).Format("2006-01-02"))
}
