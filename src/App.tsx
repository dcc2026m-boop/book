/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  Armchair, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Copy, 
  Check, 
  ExternalLink, 
  Code2, 
  Info,
  ShieldAlert
} from 'lucide-react';

export const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxncU6voDzA0pNBPNk8p7O8lFGMDXGUl2lgmHnI9UzDxKJwygfpigzRCcqrWYsTomKr/exec";

// Time slots
const TIME_SLOTS = [
  "09:00 - 12:00 (오전)",
  "13:00 - 16:00 (오후)",
  "17:00 - 20:00 (야간)"
];

const SEATS = Array.from({ length: 10 }, (_, i) => i + 1);

export default function App() {
  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [date, setDate] = useState<string>(getTodayString());
  const [time, setTime] = useState<string>(TIME_SLOTS[0]);
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  
  const [bookedSeats, setBookedSeats] = useState<number[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showCodeModal, setShowCodeModal] = useState<boolean>(false);
  const [showGasModal, setShowGasModal] = useState<boolean>(false);
  const [copiedHtml, setCopiedHtml] = useState<boolean>(false);
  const [copiedGas, setCopiedGas] = useState<boolean>(false);

  // Fetch booked seats when date or time changes
  const fetchBookedSeats = useCallback(async (selectedDate: string, selectedTime: string) => {
    setIsLoadingBookings(true);
    setFetchError(null);
    setSelectedSeat(null); // Reset seat selection

    try {
      const cleanTime = selectedTime.split(' ')[0]; // e.g. "09:00"
      const url = `${SCRIPT_URL}?action=getBookings&date=${encodeURIComponent(selectedDate)}&time=${encodeURIComponent(selectedTime)}&slot=${encodeURIComponent(cleanTime)}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      }).catch(err => {
        throw new Error('네트워크 연결 확인 필요: ' + (err.message || ''));
      });
      
      clearTimeout(timeoutId);

      const text = await response.text();
      let data: any = null;

      try {
        data = JSON.parse(text);
      } catch (e) {
        // If response is HTML or contains doGet error
        if (text.includes('doGet')) {
          setFetchError('구글 앱스 스크립트에 doGet 함수가 등록되어 있지 않아 기존 예약 내역을 불러오지 못했습니다. 아래 "GAS 설정 안내"를 확인해주세요.');
          setBookedSeats([]);
          return;
        }
      }

      if (data) {
        let seats: number[] = [];
        if (Array.isArray(data)) {
          // If returned an array of booked seat numbers or reservation objects
          seats = data.map((item: any) => {
            if (typeof item === 'number') return item;
            if (typeof item === 'string') return parseInt(item, 10);
            if (item && item.seat) return parseInt(item.seat, 10);
            if (item && item.seatNumber) return parseInt(item.seatNumber, 10);
            return null;
          }).filter((s): s is number => s !== null && !isNaN(s));
        } else if (data.bookedSeats && Array.isArray(data.bookedSeats)) {
          seats = data.bookedSeats.map((s: any) => parseInt(s, 10)).filter((s: number) => !isNaN(s));
        } else if (data.data && Array.isArray(data.data)) {
          // Array of objects from sheet
          seats = data.data
            .filter((row: any) => {
              const rDate = String(row.date || row[0] || '').trim();
              const rTime = String(row.time || row[1] || '').trim();
              return (!rDate || rDate === selectedDate) && (!rTime || rTime.includes(cleanTime) || rTime === selectedTime);
            })
            .map((row: any) => parseInt(row.seat || row.seatNumber || row[2], 10))
            .filter((s: number) => !isNaN(s));
        }
        setBookedSeats(seats);
      } else {
        setBookedSeats([]);
      }
    } catch (err: any) {
      console.warn('예약 내역 조회 중 알림:', err);
      // Don't completely block user if GAS doGet is not deployed yet
      setFetchError('구글 앱스 스크립트 연결 확인 필요 (현재 예약 목록을 불러올 수 없지만 예약 신청은 가능합니다)');
      setBookedSeats([]);
    } finally {
      setIsLoadingBookings(false);
    }
  }, []);

  useEffect(() => {
    fetchBookedSeats(date, time);
  }, [date, time, fetchBookedSeats]);

  const handleSeatClick = (seatNum: number) => {
    if (bookedSeats.includes(seatNum)) return;
    if (selectedSeat === seatNum) {
      setSelectedSeat(null);
    } else {
      setSelectedSeat(seatNum);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    let formatted = raw;
    if (raw.length > 3 && raw.length <= 7) {
      formatted = `${raw.slice(0, 3)}-${raw.slice(3)}`;
    } else if (raw.length > 7) {
      formatted = `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7, 11)}`;
    }
    setPhone(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!date) {
      alert('예약 날짜를 선택해주세요.');
      return;
    }
    if (!time) {
      alert('예약 시간을 선택해주세요.');
      return;
    }
    if (!selectedSeat) {
      alert('자리를 선택해주세요 (1번~10번).');
      return;
    }
    if (!name.trim()) {
      alert('이름을 입력해주세요.');
      return;
    }
    if (!phone.trim() || phone.replace(/[^0-9]/g, '').length < 9) {
      alert('올바른 전화번호를 입력해주세요.');
      return;
    }

    const payload = {
      date: date,
      time: time,
      selectedSeat: selectedSeat,
      seat: selectedSeat,
      name: name.trim(),
      phone: phone.trim(),
      timestamp: new Date().toISOString()
    };

    setIsSubmitting(true);

    try {
      // POST request to SCRIPT_URL
      // Note: GAS handles POST with redirect; text/plain avoids CORS preflight blocking
      const response = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify(payload),
      });

      let resText = "";
      try {
        resText = await response.text();
      } catch (e) {
        // Ignored
      }

      let resJson: any = null;
      try {
        resJson = JSON.parse(resText);
      } catch (e) {
        // might be text or redirect HTML
      }

      if (resJson && resJson.result === "error") {
        alert("예약 실패: " + (resJson.message || "오류가 발생했습니다."));
      } else {
        alert(`[예약 완료]\n날짜: ${date}\n시간: ${time}\n좌석: ${selectedSeat}번\n예약자: ${name}\n\n성공적으로 예약되었습니다!`);
        window.location.reload();
      }
    } catch (error: any) {
      console.error("예약 전송 중 오류:", error);
      // In case of GAS CORS opaque or network redirect
      alert(`예약 요청이 전송되었습니다.\n구글 시트('도서관 자리')에 데이터가 기록되었는지 확인해주세요.\n\n확인을 누르면 페이지를 새로고침합니다.`);
      window.location.reload();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Full standalone HTML string for single-file deployment
  const standaloneHtmlCode = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>도서관 자리 예약 시스템</title>
  <style>
    :root {
      --primary: #2563eb;
      --primary-hover: #1d4ed8;
      --primary-light: #eff6ff;
      --occupied: #9ca3af;
      --occupied-bg: #f3f4f6;
      --border: #e5e7eb;
      --text: #1f2937;
      --text-muted: #6b7280;
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --radius: 12px;
      --shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", "Pretendard", sans-serif;
    }

    body {
      background-color: var(--bg);
      color: var(--text);
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 16px;
    }

    .container {
      width: 100%;
      max-width: 480px;
      background: var(--card-bg);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 24px;
      border: 1px solid var(--border);
    }

    .header {
      text-align: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }

    .header h1 {
      font-size: 1.5rem;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.02em;
      margin-bottom: 6px;
    }

    .header p {
      font-size: 0.875rem;
      color: var(--text-muted);
    }

    .form-group {
      margin-bottom: 20px;
    }

    .form-label {
      display: block;
      font-size: 0.875rem;
      font-weight: 600;
      color: #374151;
      margin-bottom: 8px;
    }

    .form-control {
      width: 100%;
      padding: 12px 14px;
      font-size: 0.95rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
      background-color: #fff;
    }

    .form-control:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
    }

    /* Seat Grid */
    .seats-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .seat-status-legend {
      display: flex;
      gap: 12px;
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 3px;
    }
    .legend-dot.available { background: #fff; border: 1px solid var(--border); }
    .legend-dot.selected { background: var(--primary); }
    .legend-dot.occupied { background: var(--occupied); }

    .seats-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 10px;
      margin-bottom: 8px;
    }

    .seat-btn {
      aspect-ratio: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #ffffff;
      border: 1.5px solid var(--border);
      border-radius: 10px;
      cursor: pointer;
      font-weight: 700;
      font-size: 1.1rem;
      color: #374151;
      transition: all 0.15s ease;
      position: relative;
    }

    .seat-btn .seat-tag {
      font-size: 0.65rem;
      font-weight: 500;
      margin-top: 2px;
      color: var(--text-muted);
    }

    .seat-btn:hover:not(:disabled) {
      border-color: var(--primary);
      background-color: var(--primary-light);
      color: var(--primary);
    }

    .seat-btn.selected {
      background: var(--primary);
      color: #ffffff;
      border-color: var(--primary);
      box-shadow: 0 4px 10px rgba(37, 99, 235, 0.35);
    }

    .seat-btn.selected .seat-tag {
      color: #ffffff;
    }

    .seat-btn:disabled, .seat-btn.occupied {
      background: var(--occupied-bg);
      border-color: #e5e7eb;
      color: var(--occupied);
      cursor: not-allowed;
      opacity: 0.75;
    }

    .seat-btn.occupied .seat-tag {
      color: #9ca3af;
    }

    .submit-btn {
      width: 100%;
      padding: 14px;
      background: var(--primary);
      color: #fff;
      font-size: 1rem;
      font-weight: 600;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.15s;
      margin-top: 8px;
    }

    .submit-btn:hover {
      background: var(--primary-hover);
    }

    .submit-btn:disabled {
      background: #93c5fd;
      cursor: not-allowed;
    }

    .loading-banner {
      font-size: 0.8rem;
      color: var(--text-muted);
      text-align: center;
      padding: 6px;
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <h1>도서관 자리 예약</h1>
      <p>원하는 날짜와 시간의 좌석을 예약하세요</p>
    </header>

    <form id="reservationForm">
      <!-- 1. 날짜 선택 -->
      <div class="form-group">
        <label for="dateInput" class="form-label">예약 날짜</label>
        <input type="date" id="dateInput" class="form-control" required />
      </div>

      <!-- 2. 시간 선택 -->
      <div class="form-group">
        <label for="timeSelect" class="form-label">이용 시간</label>
        <select id="timeSelect" class="form-control" required>
          <option value="09:00 - 12:00">09:00 - 12:00 (오전)</option>
          <option value="13:00 - 16:00">13:00 - 16:00 (오후)</option>
          <option value="17:00 - 20:00">17:00 - 20:00 (야간)</option>
        </select>
      </div>

      <!-- 3. 자리 선택 -->
      <div class="form-group">
        <div class="seats-header">
          <label class="form-label" style="margin-bottom: 0;">자리 선택 (1번 ~ 10번)</label>
          <div class="seat-status-legend">
            <span class="legend-item"><span class="legend-dot available"></span> 가능</span>
            <span class="legend-item"><span class="legend-dot selected"></span> 선택</span>
            <span class="legend-item"><span class="legend-dot occupied"></span> 예약됨</span>
          </div>
        </div>

        <div id="loadingStatus" class="loading-banner" style="display: none;">
          좌석 현황 확인 중...
        </div>

        <div class="seats-grid" id="seatsGrid">
          <!-- 1번~10번 좌석 동적 생성 -->
        </div>
      </div>

      <!-- 4. 이름 입력 -->
      <div class="form-group">
        <label for="nameInput" class="form-label">예약자 성명</label>
        <input type="text" id="nameInput" class="form-control" placeholder="홍길동" required />
      </div>

      <!-- 5. 전화번호 입력 -->
      <div class="form-group">
        <label for="phoneInput" class="form-label">전화번호</label>
        <input type="tel" id="phoneInput" class="form-control" placeholder="010-1234-5678" required />
      </div>

      <!-- 6. 예약하기 버튼 -->
      <button type="submit" id="submitBtn" class="submit-btn">예약하기</button>
    </form>
  </div>

  <script>
    // [필수 조건] 구글 앱스 스크립트 고정 URL
    const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxncU6voDzA0pNBPNk8p7O8lFGMDXGUl2lgmHnI9UzDxKJwygfpigzRCcqrWYsTomKr/exec";

    let selectedSeat = null;
    let bookedSeats = [];

    const dateInput = document.getElementById("dateInput");
    const timeSelect = document.getElementById("timeSelect");
    const seatsGrid = document.getElementById("seatsGrid");
    const nameInput = document.getElementById("nameInput");
    const phoneInput = document.getElementById("phoneInput");
    const submitBtn = document.getElementById("submitBtn");
    const loadingStatus = document.getElementById("loadingStatus");
    const reservationForm = document.getElementById("reservationForm");

    // 오늘 날짜로 기본 세팅
    function initDate() {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      dateInput.value = \`\${yyyy}-\${mm}-\${dd}\`;
      dateInput.min = \`\${yyyy}-\${mm}-\${dd}\`;
    }

    // 좌석 그리드 1번 ~ 10번 렌더링
    function renderSeats() {
      seatsGrid.innerHTML = "";
      for (let i = 1; i <= 10; i++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "seat-btn";
        btn.dataset.seatNumber = i;

        const isOccupied = bookedSeats.includes(i);
        const isSelected = selectedSeat === i;

        if (isOccupied) {
          btn.classList.add("occupied");
          btn.disabled = true;
          btn.innerHTML = \`<span>\${i}</span><span class="seat-tag">마감</span>\`;
        } else if (isSelected) {
          btn.classList.add("selected");
          btn.innerHTML = \`<span>\${i}</span><span class="seat-tag">선택됨</span>\`;
        } else {
          btn.innerHTML = \`<span>\${i}</span><span class="seat-tag">가능</span>\`;
          btn.addEventListener("click", () => selectSeat(i));
        }

        seatsGrid.appendChild(btn);
      }
    }

    // 좌석 클릭 핸들러
    function selectSeat(seatNumber) {
      if (bookedSeats.includes(seatNumber)) return;
      if (selectedSeat === seatNumber) {
        selectedSeat = null;
      } else {
        selectedSeat = seatNumber;
      }
      renderSeats();
    }

    // 예약 현황 불러오기 (GET)
    async function loadBookedSeats() {
      const date = dateInput.value;
      const time = timeSelect.value;
      if (!date || !time) return;

      selectedSeat = null;
      loadingStatus.style.display = "block";
      loadingStatus.textContent = "좌석 예약 현황을 불러오는 중...";

      try {
        const query = \`?action=getBookings&date=\${encodeURIComponent(date)}&time=\${encodeURIComponent(time)}\`;
        const res = await fetch(SCRIPT_URL + query, { method: "GET" });
        const text = await res.text();
        
        let data = [];
        try {
          data = JSON.parse(text);
        } catch(e) {
          data = [];
        }

        if (Array.isArray(data)) {
          bookedSeats = data.map(item => {
            if (typeof item === 'number') return item;
            if (item && item.seat) return parseInt(item.seat, 10);
            return parseInt(item, 10);
          }).filter(n => !isNaN(n));
        } else if (data && data.bookedSeats) {
          bookedSeats = data.bookedSeats.map(n => parseInt(n, 10)).filter(n => !isNaN(n));
        } else {
          bookedSeats = [];
        }
      } catch (err) {
        console.warn("예약 목록 조회 알림:", err);
        bookedSeats = [];
      } finally {
        loadingStatus.style.display = "none";
        renderSeats();
      }
    }

    // 날짜/시간 변경 이벤트
    dateInput.addEventListener("change", loadBookedSeats);
    timeSelect.addEventListener("change", loadBookedSeats);

    // 전화번호 하이픈 자동완성
    phoneInput.addEventListener("input", (e) => {
      let val = e.target.value.replace(/[^0-9]/g, "");
      if (val.length > 3 && val.length <= 7) {
        val = val.slice(0, 3) + "-" + val.slice(3);
      } else if (val.length > 7) {
        val = val.slice(0, 3) + "-" + val.slice(3, 7) + "-" + val.slice(7, 11);
      }
      e.target.value = val;
    });

    // 폼 제출 (POST)
    reservationForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!selectedSeat) {
        alert("자리를 선택해주세요 (1번~10번).");
        return;
      }

      const date = dateInput.value;
      const time = timeSelect.value;
      const name = nameInput.value.trim();
      const phone = phoneInput.value.trim();

      if (!name) {
        alert("이름을 입력해주세요.");
        return;
      }
      if (!phone) {
        alert("전화번호를 입력해주세요.");
        return;
      }

      const payload = {
        date: date,
        time: time,
        selectedSeat: selectedSeat,
        name: name,
        phone: phone
      };

      submitBtn.disabled = true;
      submitBtn.textContent = "예약 처리 중...";

      try {
        const response = await fetch(SCRIPT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=utf-8"
          },
          body: JSON.stringify(payload)
        });

        alert(\`[예약 완료]\\n날짜: \${date}\\n시간: \${time}\\n좌석: \${selectedSeat}번\\n예약자: \${name}\\n\\n성공적으로 예약되었습니다!\`);
        window.location.reload();
      } catch (error) {
        console.error("예약 전송 결과:", error);
        alert(\`예약 요청이 전송되었습니다.\\n구글 시트('도서관 자리')를 확인해주세요.\`);
        window.location.reload();
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "예약하기";
      }
    });

    // 초기화 실행
    initDate();
    loadBookedSeats();
  </script>
</body>
</html>`;

  // Sample Google Apps Script backend code
  const gasBackendCode = `// Google Apps Script (도서관 자리 예약 시스템 백엔드)
// 스프레드시트 탭 이름: "도서관 자리", "회원명단"

function doGet(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("도서관 자리");
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ bookedSeats: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    const params = e.parameter || {};
    const targetDate = params.date || "";
    const targetTime = params.time || "";

    const data = sheet.getDataRange().getValues();
    // 헤더 행을 제외하고 데이터 순회 (A열: 날짜, B열: 시간, C열: 자리번호, D열: 이름, E열: 전화번호)
    const booked = [];
    for (let i = 1; i < data.length; i++) {
      const rowDate = String(data[i][0]).trim();
      const rowTime = String(data[i][1]).trim();
      const rowSeat = Number(data[i][2]);

      // 날짜와 시간이 일치하는 경우 예약된 좌석으로 추가
      if (rowDate === targetDate && (rowTime === targetTime || rowTime.indexOf(targetTime.slice(0, 5)) !== -1)) {
        if (!isNaN(rowSeat)) {
          booked.push(rowSeat);
        }
      }
    }

    return ContentService.createTextOutput(JSON.stringify(booked))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message, bookedSeats: [] }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const rawData = e.postData.contents;
    const body = JSON.parse(rawData);

    const date = body.date;
    const time = body.time;
    const seat = body.selectedSeat || body.seat;
    const name = body.name;
    const phone = body.phone;
    const now = new Date();

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("도서관 자리");
    
    // 시트가 없으면 자동 생성 및 헤더 삽입
    if (!sheet) {
      sheet = ss.insertSheet("도서관 자리");
      sheet.appendRow(["예약날짜", "이용시간", "자리번호", "이름", "전화번호", "등록일시"]);
    } else if (sheet.getLastRow() === 0) {
      sheet.appendRow(["예약날짜", "이용시간", "자리번호", "이름", "전화번호", "등록일시"]);
    }

    // 중복 예약 검증
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(date).trim() &&
          String(data[i][1]).trim() === String(time).trim() &&
          Number(data[i][2]) === Number(seat)) {
        return ContentService.createTextOutput(JSON.stringify({
          result: "error",
          message: "이미 해당 시간대에 예약된 자리입니다."
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // 신규 예약 행 추가
    sheet.appendRow([date, time, seat, name, phone, now]);

    return ContentService.createTextOutput(JSON.stringify({
      result: "success",
      message: "예약이 성공적으로 완료되었습니다."
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      result: "error",
      message: err.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

  const copyToClipboard = (text: string, type: 'html' | 'gas') => {
    navigator.clipboard.writeText(text);
    if (type === 'html') {
      setCopiedHtml(true);
      setTimeout(() => setCopiedHtml(false), 2000);
    } else {
      setCopiedGas(true);
      setTimeout(() => setCopiedGas(false), 2000);
    }
  };

  const downloadHtmlFile = () => {
    const blob = new Blob([standaloneHtmlCode], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'index.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between py-6 px-4 sm:px-6">
      {/* Top Banner with Quick Actions */}
      <header className="max-w-xl mx-auto w-full mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
            <Armchair className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-tight">
              도서관 자리 예약 시스템
            </h1>
            <p className="text-xs text-slate-500">
              구글 시트(도서관 자리) 실시간 연동
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCodeModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors shadow-2xs"
            title="Vercel 배포용 단일 index.html 파일 확인"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Vercel 배포용</span> index.html
          </button>
          <button
            type="button"
            onClick={() => setShowGasModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
            title="구글 앱스 스크립트 코드"
          >
            <Info className="w-3.5 h-3.5" />
            <span>GAS 안내</span>
          </button>
        </div>
      </header>

      {/* Main Reservation Card */}
      <main className="max-w-xl mx-auto w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-7">
        {fetchError && (
          <div className="mb-5 p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">{fetchError}</p>
              <p className="text-amber-700 mt-0.5">
                상단 <strong>[GAS 안내]</strong> 버튼을 눌러 스프레드시트에 <code className="bg-amber-100 px-1 py-0.5 rounded">doGet</code> 함수를 배포하면 기존 예약 차단이 완벽하게 동기화됩니다.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 1. 날짜 및 시간 선택 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="date" className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                예약 날짜
              </label>
              <input
                id="date"
                type="date"
                value={date}
                min={getTodayString()}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-800"
              />
            </div>

            <div>
              <label htmlFor="time" className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                이용 시간
              </label>
              <select
                id="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-800 cursor-pointer"
              >
                {TIME_SLOTS.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. 자리 선택 영역 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Armchair className="w-3.5 h-3.5 text-slate-400" />
                자리 선택 (총 10석)
              </label>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-white border border-slate-300"></span>
                  가능
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-blue-600"></span>
                  선택됨
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-slate-300"></span>
                  예약불가
                </span>
              </div>
            </div>

            {isLoadingBookings && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 py-1 mb-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                <span>선택한 날짜/시간의 실시간 예약 현황 조회 중...</span>
              </div>
            )}

            {/* 자리 10개 그리드 (5열 2행) */}
            <div className="grid grid-cols-5 gap-2.5 p-3.5 bg-slate-50/70 border border-slate-200/60 rounded-xl">
              {SEATS.map((seatNum) => {
                const isBooked = bookedSeats.includes(seatNum);
                const isSelected = selectedSeat === seatNum;

                return (
                  <button
                    key={seatNum}
                    type="button"
                    disabled={isBooked}
                    onClick={() => handleSeatClick(seatNum)}
                    className={`
                      relative aspect-square flex flex-col items-center justify-center rounded-xl font-bold text-base transition-all
                      ${
                        isBooked
                          ? 'bg-slate-200/70 border border-slate-300/80 text-slate-400 cursor-not-allowed opacity-60'
                          : isSelected
                          ? 'bg-blue-600 border border-blue-600 text-white shadow-md shadow-blue-500/20 scale-[1.02]'
                          : 'bg-white border border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50/50 cursor-pointer active:scale-95'
                      }
                    `}
                  >
                    <span>{seatNum}</span>
                    <span
                      className={`text-[10px] font-medium leading-none mt-0.5 ${
                        isSelected
                          ? 'text-blue-100'
                          : isBooked
                          ? 'text-slate-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {isBooked ? '마감' : isSelected ? '선택' : '번'}
                    </span>
                  </button>
                );
              })}
            </div>
            
            {selectedSeat ? (
              <p className="mt-2 text-xs font-medium text-blue-700 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                현재 <strong>{selectedSeat}번 좌석</strong>이 선택되었습니다.
              </p>
            ) : (
              <p className="mt-2 text-xs text-slate-400">
                원하는 빈 좌석 번호를 터치/클릭해주세요.
              </p>
            )}
          </div>

          {/* 3. 예약자 정보 입력 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1 border-t border-slate-100">
            <div>
              <label htmlFor="name" className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                이름 (회원명)
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
                required
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-800"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                전화번호
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="010-1234-5678"
                required
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-800"
              />
            </div>
          </div>

          {/* 4. 예약하기 버튼 */}
          <button
            type="submit"
            disabled={isSubmitting || !selectedSeat}
            className={`
              w-full py-3.5 px-4 rounded-xl text-sm font-bold text-white transition-all shadow-sm
              ${
                isSubmitting || !selectedSeat
                  ? 'bg-slate-300 cursor-not-allowed text-slate-500'
                  : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.99] shadow-blue-600/20 cursor-pointer'
              }
            `}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                구글 시트에 예약 등록 중...
              </span>
            ) : selectedSeat ? (
              `[${date}] ${time.split(' ')[0]} / ${selectedSeat}번 자리 예약하기`
            ) : (
              '자리를 먼저 선택해주세요'
            )}
          </button>
        </form>

        {/* 연동된 구글 앱스 스크립트 주소 표시 */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span className="truncate max-w-[340px]" title={SCRIPT_URL}>
            엔드포인트: <span className="font-mono text-slate-600">{SCRIPT_URL.slice(0, 38)}.../exec</span>
          </span>
          <span className="shrink-0 text-emerald-600 font-medium">연동 준비 완료</span>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="max-w-xl mx-auto w-full text-center mt-4">
        <p className="text-xs text-slate-400">
          Vercel 배포를 위한 <code className="bg-slate-200/60 px-1 py-0.5 rounded text-slate-600 font-mono">index.html</code> 단일 파일 및 구글 앱스 스크립트 코드를 제공합니다.
        </p>
      </footer>

      {/* Standalone index.html Modal */}
      {showCodeModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Vercel 배포용 단일 index.html 파일
                </h3>
                <p className="text-xs text-slate-500">
                  외부 빌드나 의존성 없이 Vercel 정적 호스팅에 바로 배포할 수 있는 완전한 단일 HTML 파일입니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCodeModal(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center text-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-slate-900 text-slate-200 overflow-y-auto font-mono text-xs leading-relaxed flex-1">
              <pre className="whitespace-pre">{standaloneHtmlCode}</pre>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={downloadHtmlFile}
                className="px-3.5 py-2 text-xs font-semibold bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors shadow-2xs"
              >
                index.html 파일 다운로드
              </button>
              <button
                type="button"
                onClick={() => copyToClipboard(standaloneHtmlCode, 'html')}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-2xs"
              >
                {copiedHtml ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedHtml ? '복사 완료!' : '전체 코드 복사'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GAS Setup Modal */}
      {showGasModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  구글 앱스 스크립트 (GAS) 백엔드 코드
                </h3>
                <p className="text-xs text-slate-500">
                  구글 시트의 [확장 프로그램] → [Apps Script]에 붙여넣고 [웹 앱으로 배포]하면 예약이 자동 저장됩니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGasModal(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center text-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-slate-900 text-slate-200 overflow-y-auto font-mono text-xs leading-relaxed flex-1">
              <pre className="whitespace-pre">{gasBackendCode}</pre>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                액세스 권한: <strong>모든 사용자(Anyone)</strong>로 배포해야 합니다.
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(gasBackendCode, 'gas')}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-2xs"
              >
                {copiedGas ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedGas ? '복사 완료!' : 'GAS 코드 복사'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
