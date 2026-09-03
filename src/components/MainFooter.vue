<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
const router = useRouter();
const currentYear = computed(() => new Date().getFullYear());
const goTo = (path: string) => {
  router.push(path);
};
</script>
<template>
  <div class="desktop-tablet-footer">
    <footer class="site-footer glass-panel-footer">
      <div class="footer-content">
        <div class="footer-brand">
          <h3 class="footer-title text-gradient">VitalCare</h3>
          <p class="footer-desc">
            ระบบส่งเสริมกิจกรรมสุขภาพเเละติดตามพฤติกรรมสุขภาพของผู้ใช้
          </p>
          <div class="dev-tag-footer">
            DEVELOPED BY TEAM VITALCARE @ SUT HOSPITAL
          </div>
        </div>
        <div class="footer-contact">
          <h4 class="link-heading">ติดต่อเรา</h4>
          <p>
            โรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี 111 ถ.มหาวิทยาลัย ต.สุรนารี
          </p>
          <p>
            อ.เมือง จ.นครราชสีมา โทร
            <a href="tel:044376555" class="hover-text-primary">0 4437 6555</a> ,
            แฟกซ์ 0 4437 6999
          </p>
          <p>
            <a
              href="https://www.suth.go.th"
              target="_blank"
              rel="noopener noreferrer"
              class="hover-text-primary"
              >www.suth.go.th</a
            >
          </p>
        </div>
      </div>
      <div class="footer-bottom">
        <p>&copy; {{ currentYear }} VitalCare. All rights reserved.</p>
      </div>
    </footer>
  </div>
</template>
<style scoped>
.desktop-tablet-footer {
  width: 100%;
  margin-top: auto;
}
.text-gradient {
  background: linear-gradient(135deg, #219ebc, #f47835);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  display: inline-block;
}
.glass-panel-footer {
  background: #f5f5f5;
  border-top: 1px solid #eaeaea;
  box-sizing: border-box;
}
.site-footer {
  padding: clamp(2rem, 4vh, 4rem) 5% 1.5rem;
  width: 100%;
  flex-shrink: 0;
  font-family: var(
    --font-sans,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Roboto,
    sans-serif
  );
}
.footer-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  gap: 3rem;
  margin-bottom: 2rem;
  text-align: left;
}
.footer-title {
  font-size: 1.8rem;
  font-weight: 800;
  margin: 0 0 1rem;
}
.footer-desc {
  color: #64748b;
  font-size: 0.95rem;
  margin: 0 0 1.5rem;
  max-width: 400px;
  line-height: 1.6;
}
.dev-tag-footer {
  font-size: 0.75rem;
  color: #219ebc;
  font-weight: 600;
  letter-spacing: 1px;
}
.link-heading {
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0 0 1.2rem;
  color: #1e293b;
}
.footer-links ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}
.footer-links a,
.footer-contact p {
  color: #64748b;
  text-decoration: none;
  font-size: 0.95rem;
  margin: 0;
  transition: color 0.2s ease;
  cursor: pointer;
}
.hover-text-primary:hover {
  color: #219ebc !important;
}
.footer-bottom {
  border-top: 1px solid rgba(226, 232, 240, 0.8);
  text-align: center;
  padding-top: 1.5rem;
}
.footer-bottom p {
  color: #64748b;
  font-size: 0.85rem;
  margin: 0;
}
@media (max-width: 1024px) {
  .footer-content {
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 2rem;
  }
  .footer-brand {
    text-align: center;
  }
  .footer-brand .footer-desc {
    margin: 0 auto 1.5rem;
  }
}
/* Hide entirely on mobile screens under 768px */
@media (max-width: 767px) {
  .desktop-tablet-footer {
    display: none !important;
  }
}
</style>
