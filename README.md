# Ping Pong

Mouse ile yön, güç ve falso kontrolü olan 3D masa tenisi. Bilgisayara karşı antrenman ve P2P (WebRTC) ile online 1v1.

## Çalıştırma

    npm install
    npm run dev      # geliştirme sunucusu
    npm test         # birim testleri
    npm run build    # dist/ içine statik site

`dist/` klasörü GitHub Pages, Netlify vb. herhangi bir statik barındırmaya konabilir. Online mod için HTTPS (veya localhost) gerekir.

## Kontroller

- Mouse: raketi hareket ettir (sağ/sol + ileri/geri)
- Topa doğru savur: vuruş. İleri hız = güç, yanal hız = yön
- Sol tuş basılı: topspin · Sağ tuş basılı: backspin · Sert yanal savurma: yan falso
- Servis: tıkla (top havaya atılır), düşerken vur
- Esc: imleci bırak (antrenmanda duraklatır)

## Online

"Oda kur" → 4 haneli kod / davet linki. Arkadaşın linki açar ya da kodu girer. Bağlantı PeerJS genel sunucusu + STUN üzerinden doğrudan kurulur; çok kısıtlı kurumsal ağlarda çalışmayabilir. Rakibin bağlantısı koparsa (sekme kapanır ya da 8 sn yanıt gelmezse) oyun menüye döner.
