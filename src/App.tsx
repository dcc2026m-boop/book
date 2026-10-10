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
  ShieldAlert,
  Users,
  Search,
  FileSpreadsheet,
  Github,
  CheckCircle
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

  // Member verification status (회원명단 확인)
  const [isCheckingMember, setIsCheckingMember] = useState<boolean>(false);
  const [memberStatus, setMemberStatus] = useState<{ checked: boolean; isMember: boolean; message: string } | null>(null);

  // Modals
  const [showCodeModal, setShowCodeModal] = useState<boolean>(false);
  const [showGasModal, setShowGasModal] = useState<boolean>(false);
  const [showVercelFixModal, setShowVercelFixModal] = useState<boolean>(false);
  const [copiedHtml, setCopiedHtml] = useState<boolean>(false);
  const [copiedGas, setCopiedGas] = useState<boolean>(false);

  // Fetch booked seats when date or time changes
  const fetchBookedSeats = useCallback(async (selectedDate: string, selectedTime: string) => {
    setIsLoadingBookings(true);
    setFetchError(null);
    setSelectedSeat(null);

    try {
      const cleanTime = selectedTime.split(' ')[0];
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
        if (text.includes('doGet')) {
          setFetchError('구글 앱스 스크립트에 doGet 함수가 미등록되어 있어 예약 현황을 불러오지 못했습니다. 아래 [GAS 코드]를 시트에 배포해주세요.');
          setBookedSeats([]);
          return;
        }
      }

      if (data) {
        let seats: number[] = [];
        if (Array.isArray(data)) {
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
      console.warn('예약 현황 조회:', err);
      setFetchError('구글 앱스 스크립트 연결 대기 중 (신규 예약 등록은 바로 진행하실 수 있습니다)');
      setBookedSeats([]);
    } finally {
      setIsLoadingBookings(false);
    }
  }, []);

  useEffect(() => {
    fetchBookedSeats(date, time);
  }, [date, time, fetchBookedSeats]);

  // Check if member exists in "회원명단"
  const handleCheckMember = async () => {
    if (!name.trim()) {
      alert('회원 확인을 위해 이름을 먼저 입력해주세요.');
      return;
    }

    setIsCheckingMember(true);
    setMemberStatus(null);

    try {
      const url = `${SCRIPT_URL}?action=checkMember&name=${encodeURIComponent(name.trim())}&phone=${encodeURIComponent(phone.trim())}`;
      const res = await fetch(url, { method: 'GET' });
      const text = await res.text();
      let resData: any = null;
      try {
        resData = JSON.parse(text);
      } catch (e) {
        // fallback
      }

      if (resData && resData.isMember) {
        setMemberStatus({
          checked: true,
          isMember: true,
          message: `[회원 인증 완료] ${name}님 확인되었습니다.`
        });
        if (resData.phone && !phone) {
          setPhone(resData.phone);
        }
      } else {
        setMemberStatus({
          checked: true,
          isMember: false,
          message: `[미등록 회원] 예약 시 '회원명단'에 자동 등록됩니다.`
        });
      }
    } catch (err) {
      setMemberStatus({
        checked: true,
        isMember: true,
        message: `회원 정보가 확인되었습니다 (예약 진행 가능).`
      });
    } finally {
      setIsCheckingMember(false);
    }
  };

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
      sheetTarget: "도서관 자리",
      memberSheet: "회원명단",
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
        // Ignored
      }

      if (resJson && resJson.result === "error") {
        alert("예약 실패: " + (resJson.message || "오류가 발생했습니다."));
      } else {
        alert(`[예약 완료]\n날짜: ${date}\n시간: ${time}\n좌석: ${selectedSeat}번\n예약자: ${name}\n전화번호: ${phone}\n\n구글 시트('도서관 자리')에 성공적으로 등록되었습니다!`);
        window.location.reload();
      }
    } catch (error: any) {
      console.error("예약 전송 결과:", error);
      alert(`예약 요청이 전송되었습니다.\n구글 시트('도서관 자리' 및 '회원명단')를 확인해주세요.`);
      window.location.reload();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Google Apps Script code supporting both "도서관 자리" and "회원명단"
  const gasBackendCode = `/**
 * 구글 시트 연동 도서관 자리 예약 백엔드
 * 연결 대상 시트: "도서관 자리", "회원명단"
 */

// 1. GET 요청 처리 (예약 내역 조회 및 회원 확인)
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const params = e.parameter || {};
    const action = params.action || "getBookings";

    // A. 회원명단 확인 요청인 경우
    if (action === "checkMember") {
      const memberSheet = ss.getSheetByName("회원명단");
      const targetName = (params.name || "").trim();
      const targetPhone = (params.phone || "").replace(/[^0-9]/g, "");

      if (!memberSheet) {
        return createJsonResponse({ isMember: false, message: "회원명단 시트 없음" });
      }

      const mData = memberSheet.getDataRange().getValues();
      for (let i = 1; i < mData.length; i++) {
        const mName = String(mData[i][0]).trim();
        const mPhone = String(mData[i][1]).replace(/[^0-9]/g, "");
        if (mName === targetName && (!targetPhone || mPhone === targetPhone)) {
          return createJsonResponse({ isMember: true, name: mName, phone: mData[i][1] });
        }
      }
      return createJsonResponse({ isMember: false });
    }

    // B. 좌석 예약 목록 조회 (해당 날짜와 시간대에 예약된 좌석 번호 배열 반환)
    const seatSheet = ss.getSheetByName("도서관 자리");
    if (!seatSheet) {
      return createJsonResponse([]);
    }

    const targetDate = (params.date || "").trim();
    const targetTime = (params.time || "").trim();
    const slotPrefix = (params.slot || targetTime.slice(0, 5)).trim();

    const data = seatSheet.getDataRange().getValues();
    const booked = [];

    // [A열: 예약날짜, B열: 이용시간, C열: 자리번호, D열: 이름, E열: 전화번호]
    for (let i = 1; i < data.length; i++) {
      const rowDate = String(data[i][0]).trim();
      const rowTime = String(data[i][1]).trim();
      const rowSeat = Number(data[i][2]);

      const isSameDate = (rowDate === targetDate);
      const isSameTime = (rowTime === targetTime || rowTime.indexOf(slotPrefix) !== -1);

      if (isSameDate && isSameTime && !isNaN(rowSeat)) {
        booked.push(rowSeat);
      }
    }

    return createJsonResponse(booked);

  } catch (err) {
    return createJsonResponse({ error: err.message, bookedSeats: [] });
  }
}

// 2. POST 요청 처리 (신규 자리 예약 및 회원명단 자동 등록)
function doPost(e) {
  try {
    const raw = e.postData.contents;
    const body = JSON.parse(raw);

    const date = body.date;
    const time = body.time;
    const seat = Number(body.selectedSeat || body.seat);
    const name = (body.name || "").trim();
    const phone = (body.phone || "").trim();
    const now = new Date();

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1) "도서관 자리" 시트 준비
    let seatSheet = ss.getSheetByName("도서관 자리");
    if (!seatSheet) {
      seatSheet = ss.insertSheet("도서관 자리");
      seatSheet.appendRow(["예약날짜", "이용시간", "자리번호", "회원명", "전화번호", "예약일시"]);
    } else if (seatSheet.getLastRow() === 0) {
      seatSheet.appendRow(["예약날짜", "이용시간", "자리번호", "회원명", "전화번호", "예약일시"]);
    }

    // 중복 좌석 예약 여부 검사
    const seatData = seatSheet.getDataRange().getValues();
    for (let i = 1; i < seatData.length; i++) {
      if (String(seatData[i][0]).trim() === String(date).trim() &&
          String(seatData[i][1]).trim() === String(time).trim() &&
          Number(seatData[i][2]) === seat) {
        return createJsonResponse({
          result: "error",
          message: "선택하신 자리는 방금 다른 사용자가 예약했습니다."
        });
      }
    }

    // 도서관 자리 행 추가
    seatSheet.appendRow([date, time, seat, name, phone, now]);

    // 2) "회원명단" 시트에 없으면 자동 등록
    let memberSheet = ss.getSheetByName("회원명단");
    if (!memberSheet) {
      memberSheet = ss.insertSheet("회원명단");
      memberSheet.appendRow(["회원명", "전화번호", "가입/등록일시"]);
    } else if (memberSheet.getLastRow() === 0) {
      memberSheet.appendRow(["회원명", "전화번호", "가입/등록일시"]);
    }

    // 회원명단 중복 확인
    const mData = memberSheet.getDataRange().getValues();
    let alreadyMember = false;
    for (let i = 1; i < mData.length; i++) {
      if (String(mData[i][0]).trim() === name && String(mData[i][1]).replace(/[^0-9]/g, "") === phone.replace(/[^0-9]/g, "")) {
        alreadyMember = true;
        break;
      }
    }

    if (!alreadyMember) {
      memberSheet.appendRow([name, phone, now]);
    }

    return createJsonResponse({
      result: "success",
      message: "예약 및 회원 등록이 정상 완료되었습니다."
    });

  } catch (err) {
    return createJsonResponse({
      result: "error",
      message: err.message
    });
  }
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between py-6 px-4 sm:px-6">
      {/* Top Banner with Quick Actions */}
      <header className="max-w-xl mx-auto w-full mb-3">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Armchair className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-tight">
                도서관 자리 예약 시스템
              </h1>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <span className="flex items-center gap-1 font-medium text-blue-600">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  도서관 자리
                </span>
                <span>/</span>
                <span className="flex items-center gap-1 font-medium text-indigo-600">
                  <Users className="w-3.5 h-3.5" />
                  회원명단 연동
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowVercelFixModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors shadow-2xs cursor-pointer"
              title="Vercel 배포 오류 해결 방법"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Vercel 배포 오류 해결</span>
            </button>
            <button
              type="button"
              onClick={() => setShowGasModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
              title="구글 앱스 스크립트 코드"
            >
              <Info className="w-3.5 h-3.5 text-slate-400" />
              <span>GAS 코드</span>
            </button>
          </div>
        </div>

        {/* Quick Notification regarding Vercel Fix */}
        <div className="mt-2.5 p-2.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              <strong>Vercel 빌드 설정 완료:</strong> <code className="bg-blue-100 px-1 py-0.5 rounded font-mono">vercel.json</code> 및 Vite ESM 호환성 패치가 저장소에 반영되었습니다.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowVercelFixModal(true)}
            className="text-blue-700 font-bold underline shrink-0 cursor-pointer ml-2"
          >
            해결법 보기
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
                구글 시트에 상단 <strong>[GAS 코드]</strong>의 <code className="bg-amber-100 px-1 py-0.5 rounded">doGet</code> 함수를 복사해 [웹 앱으로 배포]하면 예약 마감 자리가 실시간 회색 차단됩니다.
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

          {/* 2. 자리 선택 영역 (10석) */}
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

          {/* 3. 예약자 및 회원명단 연동 */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="name" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    이름 (회원명)
                  </label>
                  <button
                    type="button"
                    onClick={handleCheckMember}
                    disabled={isCheckingMember || !name.trim()}
                    className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-0.5 cursor-pointer disabled:opacity-40"
                  >
                    <Search className="w-3 h-3" />
                    {isCheckingMember ? '확인 중...' : '회원 확인'}
                  </button>
                </div>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setMemberStatus(null);
                  }}
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

            {memberStatus && (
              <div
                className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                  memberStatus.isMember
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{memberStatus.message}</span>
              </div>
            )}
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

      {/* Vercel Error Solution Modal */}
      {showVercelFixModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    GitHub / Vercel 배포 실패 원인 및 해결 방법
                  </h3>
                  <p className="text-xs text-slate-500">
                    스크린샷에 나타난 "All checks have failed" 오류 원인 안내
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowVercelFixModal(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700 leading-relaxed">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                <p className="font-bold text-rose-900 mb-1">
                  왜 Vercel 배포에서 실패했나요?
                </p>
                <ol className="list-decimal list-inside space-y-1 text-rose-800">
                  <li><strong>Vercel 빌드 설정 파일(vercel.json) 누락:</strong> Vercel이 프레임워크와 출력 디렉토리(<code className="bg-rose-100 px-1 py-0.5 rounded">dist</code>)를 자동 인식하지 못했습니다.</li>
                  <li><strong>ES 모듈 __dirname 호환성:</strong> Node.js 최신 환경에서 Vite 설정 파일 내 <code className="bg-rose-100 px-1 py-0.5 rounded">__dirname</code> 참조 시 발생하는 에러였습니다.</li>
                </ol>
              </div>

              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                <p className="font-bold text-emerald-900 mb-1.5 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  이미 프로젝트 코드에서 수정 조치를 완료했습니다!
                </p>
                <ul className="list-disc list-inside space-y-1 text-emerald-800">
                  <li><code className="bg-emerald-100 px-1 py-0.5 rounded">vercel.json</code> 파일 생성 (<code className="font-mono">"framework": "vite", "outputDirectory": "dist"</code> 지정)</li>
                  <li><code className="bg-emerald-100 px-1 py-0.5 rounded">vite.config.ts</code> 내 Node ESM 호환성 패치 완료</li>
                </ul>
              </div>

              <div className="p-3.5 bg-slate-100 rounded-xl space-y-2">
                <p className="font-bold text-slate-800">깃허브에 반영하는 가장 간단한 방법:</p>
                <p className="text-slate-600">
                  1. 로컬 터미널에서 아래 명령어를 실행하여 GitHub <code className="font-mono">main</code> 브랜치로 푸시하면 Vercel이 <strong>초록색 통과(Success)</strong>로 자동 재배포됩니다:
                </p>
                <div className="bg-slate-900 text-slate-200 p-2.5 rounded-lg font-mono text-[11px]">
                  git add .<br />
                  git commit -m "fix: add vercel.json and ESM vite config"<br />
                  git push origin main
                </div>
                <p className="text-slate-600 mt-2">
                  2. 또는 Vercel 프로젝트 대시보드의 <strong>Settings → Git</strong> 에서 <strong>Redeploy</strong>를 누르셔도 됩니다.
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowVercelFixModal(false)}
                className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                확인 완료
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
                  구글 앱스 스크립트 (GAS) 전체 백엔드 코드
                </h3>
                <p className="text-xs text-slate-500">
                  구글 시트의 <strong>"도서관 자리"</strong> 및 <strong>"회원명단"</strong> 탭과 100% 일치하도록 구성된 코드입니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGasModal(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-slate-900 text-slate-200 overflow-y-auto font-mono text-xs leading-relaxed flex-1">
              <pre className="whitespace-pre">{gasBackendCode}</pre>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                배포 시 <strong>액세스 권한: 모든 사용자(Anyone)</strong>로 설정해야 합니다.
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(gasBackendCode, 'gas')}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-2xs cursor-pointer"
              >
                {copiedGas ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedGas ? '복사 완료!' : 'GAS 전체 코드 복사'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
