# Ping Pong

**Oyna:** https://emrests.github.io/pingpong/

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
- Esc: imleci bırak (antrenmanda duraklatır, online oyun devam eder)
- Menü (sağ üstteki buton): maçtan çık ve menüye dön

## Kamera ile oynama

Menüde "Kamera ile oyna": raket webcam görüntüsünden sürülür (görüntü cihazdan çıkmaz). Önizlemedeki çerçevenin içi masanın tamamıdır; yukarı = fileye doğru. Servis: Space ya da tık.

- **El**: açık el takip edilir (MediaPipe Hand Landmarker, ilk kullanımda ~15 MB indirir). Avuç içi kameraya = topspin, el üstü = backspin, el yan = düz. Servis: elini yumruk yap, top havaya atılır. Falso ters çıkıyorsa "Sağ el / Sol el"i değiştir.
- **Defter**: defteri kutuya tutup "Rengi al"; o renk takip edilir. Parlak, tek renk kapak en iyisi. Falso mouse tuşlarıyla.

## Zorluk

Antrenman menüsünde Kolay / Orta / Zor. Seviye; rakibin vuruş hızını, yön açısını, falso sıklığını, hareket hızını ve isabetini belirler (`AI_LEVELS`, `src/ai.js`).

## Online

"Oda kur" → 4 haneli kod / davet linki. Arkadaşın linki açar ya da kodu girer. Bağlantı PeerJS genel sunucusu + STUN üzerinden doğrudan kurulur; çok kısıtlı kurumsal ağlarda çalışmayabilir. Rakibin bağlantısı koparsa (sekme kapanır ya da 8 sn yanıt gelmezse) oyun menüye döner.
